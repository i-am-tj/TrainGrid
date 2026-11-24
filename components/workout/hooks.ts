"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveWorkoutAction, type WorkoutActionResult, type WorkoutWriteCheck } from "@/lib/workouts/actions";
import { isLaterVersion, type WeightUnit, type WorkoutEntries, type WorkoutLog } from "@/lib/workouts/model";

/** The workout as this phone last saw it, kept so a lost signal never loses a set. */
export type LocalWorkout = {
  unit: WeightUnit;
  entries: WorkoutEntries;
  notes: string;
  /** ms since epoch, this device's clock. */
  savedAt: number;
  /** The log's updated_at these values were made on top of. Absent in copies kept before versions. */
  base?: string | null;
  /** True while these values have not reached TrainGrid. */
  pending?: boolean;
  /** When the current rest ends (ms since epoch), so a reload keeps the timer. */
  restEndsAt?: number | null;
  restTotal?: number | null;
};

const localKey = (sessionId: string) => `traingrid:workout:${sessionId}`;

export function readLocalWorkout(sessionId: string): LocalWorkout | null {
  try {
    const raw = window.localStorage.getItem(localKey(sessionId));
    return raw ? (JSON.parse(raw) as LocalWorkout) : null;
  } catch {
    return null;
  }
}

export function writeLocalWorkout(sessionId: string, value: LocalWorkout) {
  try {
    window.localStorage.setItem(localKey(sessionId), JSON.stringify(value));
  } catch {
    // Storage full or blocked: the server copy still saves.
  }
}

export function clearLocalWorkout(sessionId: string) {
  try {
    window.localStorage.removeItem(localKey(sessionId));
  } catch {
    // Nothing to clear.
  }
}

const DEVICE_KEY = "traingrid:device";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let unkeptDevice: string | null = null;

/**
 * A random id for this browser, sent with each workout save so TrainGrid can
 * tell this device's own earlier save (a reply lost to a dropped signal or a
 * reload) from another device's. Not an identity: it only labels saves.
 */
export function deviceId(): string {
  try {
    const kept = window.localStorage.getItem(DEVICE_KEY);
    if (kept && UUID.test(kept)) return kept;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked: one id for this page.
    unkeptDevice ??= crypto.randomUUID();
    return unkeptDevice;
  }
}

const QUICK_START_KEY = "traingrid:quick-start-request";

/**
 * The request id for starting a quick workout from Home, kept for this tab
 * until that workout's screen opens. A retry after a dropped response (or
 * after the error page's Try again) sends the same id, so the server returns
 * the workout it may already have started instead of a second one (F18).
 */
export function quickStartRequestId(): string {
  try {
    const kept = window.sessionStorage.getItem(QUICK_START_KEY);
    if (kept) return kept;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(QUICK_START_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked: a fresh id per visit still stops a double submit.
    return crypto.randomUUID();
  }
}

/** The workout screen for this quick start opened: the next start is a new one. */
export function settleQuickStartRequest(sessionId: string) {
  try {
    if (window.sessionStorage.getItem(QUICK_START_KEY) === sessionId) window.sessionStorage.removeItem(QUICK_START_KEY);
  } catch {
    // Nothing kept.
  }
}

export function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(`traingrid:${key}`);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(`traingrid:${key}`, value);
  } catch {
    // A preference that does not stick is fine.
  }
}

export type SaveState = "idle" | "saving" | "saved" | "offline" | "conflict";

type Progress = { unit: WeightUnit; entries: WorkoutEntries; notes: string };

/**
 * Saves progress twice: at once to this phone, and to TrainGrid a moment
 * after the last change. A failed save (no signal in the gym) leaves the
 * change marked unsaved and tries again when the connection returns, every
 * 15 seconds meanwhile, and whenever the screen is hidden.
 *
 * Every write carries `version`, the log's `updated_at` as this device last
 * saw it, and this device's id. TrainGrid applies it if the log is still at
 * that version or this device saved it last. If another device saved in
 * between, nothing is overwritten: `conflict` holds the newer log and saving
 * stops until the member picks a version (keepMine, or adopt the other one).
 */
export function useAutosave({
  sessionId,
  enabled,
  progress,
  version,
}: {
  sessionId: string;
  enabled: boolean;
  progress: Progress;
  /** The log's updated_at when the screen loaded; null before the workout starts. */
  version: string | null;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState<WorkoutLog | null>(null);
  const latest = useRef(progress);
  const base = useRef(version);
  const dirty = useRef(false);
  const blocked = useRef<WorkoutLog | null>(null);
  // The write in progress, so only one goes to TrainGrid at a time.
  const running = useRef<Promise<unknown> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // What was last seen, so only a real change is written (never a re-run of
  // the effect, which would overwrite the phone's newer copy with the page's).
  const seen = useRef(progress);

  const remember = useCallback(
    (patch: Partial<LocalWorkout>) => {
      const existing = readLocalWorkout(sessionId);
      if (existing) writeLocalWorkout(sessionId, { ...existing, ...patch });
    },
    [sessionId],
  );

  const raise = useCallback((newer: WorkoutLog) => {
    window.clearTimeout(timer.current);
    blocked.current = newer;
    dirty.current = true;
    setConflict(newer);
    setState("conflict");
  }, []);

  const exclusive = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    while (running.current) await running.current.catch(() => undefined);
    const current = task();
    running.current = current;
    try {
      return await current;
    } finally {
      running.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    // A write in progress sends later changes when it ends (see the loop).
    if (running.current || blocked.current) return;
    await exclusive(async () => {
      while (dirty.current && !blocked.current) {
        const expected = base.current;
        if (expected === null) return;
        dirty.current = false;
        setState("saving");
        const check = { expectedUpdatedAt: expected, device: deviceId() };
        const result = await saveWorkoutAction(sessionId, latest.current, check).catch(() => null);
        if (result?.ok) {
          base.current = result.value;
          remember({ base: result.value, pending: dirty.current });
          setState("saved");
          continue;
        }
        dirty.current = true;
        if (result && !result.ok && result.reason === "conflict") raise(result.latest);
        else setState("offline");
        return;
      }
    });
  }, [sessionId, exclusive, raise, remember]);

  const { unit, entries, notes } = progress;
  useEffect(() => {
    latest.current = { unit, entries, notes };
    const previous = seen.current;
    seen.current = { unit, entries, notes };
    if (!enabled) return;
    if (previous.unit === unit && previous.entries === entries && previous.notes === notes) return;
    const existing = readLocalWorkout(sessionId);
    writeLocalWorkout(sessionId, {
      ...existing,
      unit,
      entries,
      notes,
      savedAt: Date.now(),
      base: base.current,
      pending: true,
    });
    dirty.current = true;
    window.clearTimeout(timer.current);
    if (!blocked.current) timer.current = window.setTimeout(() => void flush(), 900);
  }, [enabled, sessionId, unit, entries, notes, flush]);

  useEffect(() => {
    if (!enabled) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onOnline = () => void flush();
    const retry = window.setInterval(() => {
      if (dirty.current && !running.current) void flush();
    }, 15_000);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onOnline);
      window.clearInterval(retry);
    };
  }, [enabled, flush]);

  /** Marks the current state as needing a save. */
  const markDirty = useCallback(() => {
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 300);
  }, [flush]);

  /**
   * The screen restored changes kept on this phone, made on top of `madeOn`.
   * They are saved if the page's copy is that version, is older (this
   * phone's last save landed after the page was rendered), or is this
   * device's own save. If another device saved since, the member chooses
   * between them first.
   */
  const restore = useCallback(
    (madeOn: string, server: WorkoutLog) => {
      base.current = madeOn;
      const ours = madeOn === server.updatedAt || server.savedBy === deviceId() || isLaterVersion(madeOn, server.updatedAt);
      if (ours) markDirty();
      else raise(server);
    },
    [markDirty, raise],
  );

  /**
   * The screen now shows `values` from TrainGrid at `version` (the workout
   * just started, or the member chose the other device's version). Nothing
   * to save. Pass the same objects the screen renders, so they are not
   * mistaken for a change.
   */
  const adopt = useCallback(
    (values: Progress, newVersion: string) => {
      window.clearTimeout(timer.current);
      seen.current = values;
      latest.current = values;
      base.current = newVersion;
      dirty.current = false;
      blocked.current = null;
      setConflict(null);
      const existing = readLocalWorkout(sessionId);
      writeLocalWorkout(sessionId, { ...existing, ...values, savedAt: Date.now(), base: newVersion, pending: false });
      setState("saved");
    },
    [sessionId],
  );

  /** The member keeps this device's version: it replaces the other one. */
  const keepMine = useCallback(() => {
    const newer = blocked.current;
    if (!newer) return;
    base.current = newer.updatedAt;
    blocked.current = null;
    setConflict(null);
    remember({ base: newer.updatedAt, pending: true });
    dirty.current = true;
    void flush();
  }, [flush, remember]);

  /**
   * Runs another write (finishing the workout) in turn with the saves, at the
   * current version. It sends the whole state, so pending changes go with it.
   */
  const write = useCallback(
    async (task: (check: WorkoutWriteCheck) => Promise<WorkoutActionResult<WorkoutLog>>) => {
      window.clearTimeout(timer.current);
      return exclusive(async (): Promise<WorkoutActionResult<WorkoutLog> | null> => {
        if (blocked.current) return { ok: false, reason: "conflict", latest: blocked.current };
        const expected = base.current;
        if (expected === null) return null;
        const wasDirty = dirty.current;
        dirty.current = false;
        const result = await task({ expectedUpdatedAt: expected, device: deviceId() }).catch(() => null);
        if (result?.ok) {
          base.current = result.value.updatedAt;
          return result;
        }
        dirty.current ||= wasDirty;
        if (result && !result.ok && result.reason === "conflict") raise(result.latest);
        return result;
      });
    },
    [exclusive, raise],
  );

  /** True while a change has not reached TrainGrid yet. */
  const hasUnsaved = useCallback(() => dirty.current || running.current !== null || blocked.current !== null, []);

  return { state, conflict, flush, markDirty, restore, adopt, keepMine, write, hasUnsaved };
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Keeps the screen on while `active`, re-acquiring it when the page is shown again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Battery saver or an unsupported browser: the screen may dim.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

/** The current time, ticking every `ms` while `active`. Null until mounted (no hydration mismatch). */
export function useNow(active: boolean, ms = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, ms);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active, ms]);
  return now;
}

/** A light tap on phones that support vibration. */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported.
  }
}

/**
 * A short two-note chime for the end of a rest. The audio context has to be
 * created during a tap (browser autoplay rules), so `prime()` is called when
 * a set is logged and `chime()` later when the timer runs out.
 */
export function useChime() {
  const context = useRef<AudioContext | null>(null);

  const prime = useCallback(() => {
    try {
      if (!context.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        context.current = new Ctor();
      }
      if (context.current.state === "suspended") void context.current.resume();
    } catch {
      context.current = null;
    }
  }, []);

  const chime = useCallback(() => {
    const ctx = context.current;
    if (!ctx) return;
    try {
      const start = ctx.currentTime + 0.02;
      [880, 1175].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        const at = start + index * 0.18;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.32);
      });
    } catch {
      // No sound; the vibration and the screen still say it.
    }
  }, []);

  useEffect(() => () => void context.current?.close().catch(() => undefined), []);

  return { prime, chime };
}
