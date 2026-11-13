import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EquipmentType, IsoDay, SessionType } from "@/lib/domain";

/** A Supabase client typed against the TrainGrid schema. */
export type Db = SupabaseClient<Database>;

export type RoutineScope = "GLOBAL" | "PERSONAL";

/** One planned step of a routine or a scheduled session. */
export type PlannedItem = {
  id: string;
  name: string;
  instruction: string;
  rest: string;
  target: string;
  notes: string;
  equipment: EquipmentType[];
  videoUrl: string | null;
};

export type RoutineSummary = {
  id: string;
  scope: RoutineScope;
  /** True for the caller's own PERSONAL routines. */
  isOwn: boolean;
  slug: string | null;
  name: string;
  category: SessionType;
  description: string;
};

export type Routine = RoutineSummary & { items: PlannedItem[] };

/** A routine as the library list needs it: summary plus what search and filters look at. */
export type LibraryRoutine = RoutineSummary & {
  itemNames: string[];
  /** Every equipment tag used by any item, in canonical order, without duplicates. */
  equipment: EquipmentType[];
  itemCount: number;
};

export type SnapshotItem = PlannedItem & {
  /** The routine item this was copied from, if any. Provenance only. */
  sourceItemId: string | null;
};

export type ScheduledSessionRecord = {
  id: string;
  date: string;
  weekId: string;
  day: IsoDay;
  /** "HH:MM", or null for an untimed session. */
  startTime: string | null;
  name: string;
  category: SessionType;
  durationMinutes: number | null;
  notes: string;
  /** Provenance only; never determines the content. */
  sourceRoutineId: string | null;
  items: SnapshotItem[];
};

export class DataError extends Error {
  constructor(
    readonly code: "invalid" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}
