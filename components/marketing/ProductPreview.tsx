/** Static, explicitly labelled product examples. Never reads member records. */
export function PlannerPreview() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <figure
      className="product-frame"
      aria-label="Example weekly planner, with timed and untimed training sessions"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-4">
        <span className="font-semibold">Your week, at a glance.</span>
        <span className="text-xs text-stone-600">Example training week</span>
      </figcaption>
      <div className="preview-week" aria-hidden="true">
        <div className="preview-days">
          {days.map((day, i) => (
            <div key={day} className={i === 2 ? "text-accent" : ""}>
              <span>{day}</span>
              <strong>{16 + i}</strong>
            </div>
          ))}
        </div>
        <div className="preview-grid">
          <div
            className="preview-session preview-run"
            style={{ gridColumn: 1, gridRow: "1 / 3" }}
          >
            <small>07:00 · Run</small>
            <strong>Easy run</strong>
            <span>45 min · Conversational pace</span>
          </div>
          <div
            className="preview-session preview-lift"
            style={{ gridColumn: 2, gridRow: "3 / 5" }}
          >
            <small>18:00 · Lift</small>
            <strong>Lower A</strong>
            <span>Squat · Hinge · Core</span>
          </div>
          <div
            className="preview-session preview-run"
            style={{ gridColumn: 3, gridRow: "1 / 3" }}
          >
            <small>07:00 · Run</small>
            <strong>Intervals</strong>
            <span>Warm-up + 6 × 400m</span>
          </div>
          <div
            className="preview-session preview-lift"
            style={{ gridColumn: 4, gridRow: "3 / 5" }}
          >
            <small>18:00 · Lift</small>
            <strong>Upper A</strong>
            <span>Push · Pull · Carry</span>
          </div>
          <div
            className="preview-session preview-plyo"
            style={{ gridColumn: 5, gridRow: "2 / 4" }}
          >
            <small>Untimed · Plyo</small>
            <strong>Quick feet</strong>
            <span>Keep it light</span>
          </div>
          <div
            className="preview-session preview-run"
            style={{ gridColumn: 6, gridRow: "1 / 4" }}
          >
            <small>08:00 · Run</small>
            <strong>Long run</strong>
            <span>75 min · Easy effort</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-stone-600">
        <span>Monday–Sunday. Timed or untimed.</span>
        <span aria-hidden="true">↗</span>
      </div>
    </figure>
  );
}

export function AgendaPreview({
  headingTag: Heading = "h3",
}: {
  headingTag?: "h3" | "p";
}) {
  return (
    <div className="product-frame mx-auto max-w-xs p-5">
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full bg-line"
        aria-hidden="true"
      />
      <p className="ui-eyebrow">Wednesday · Example agenda</p>
      <Heading className="mt-2 text-2xl font-semibold tracking-tight">
        A little structure.
        <br />A lot of freedom.
      </Heading>
      <div className="mt-6 border-l-2 border-accent pl-4">
        <p className="text-xs text-stone-600">07:00 · Running · 45 min</p>
        <p className="mt-2 font-semibold">Intervals</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Warm up, find your rhythm, then 6 × 400m.
        </p>
        <span className="mt-4 inline-block text-xs text-accent">
          Start workout ↗
        </span>
      </div>
      <p className="mt-8 border-t border-line pt-4 text-xs text-stone-600">
        Your plan travels with you.
      </p>
    </div>
  );
}

export function LibraryPreview() {
  return (
    <div className="product-frame p-5">
      <p className="ui-eyebrow">Example library</p>
      <div className="mt-4 inline-flex rounded-full border border-line bg-background p-1 text-xs">
        <span className="rounded-full bg-card px-4 py-2">All</span>
        <span className="px-4 py-2 text-stone-600">TrainGrid</span>
        <span className="px-4 py-2 text-stone-600">Mine</span>
      </div>
      {[
        ["Lower A", "Lift · 5 items · Barbell, Dumbbell"],
        ["Easy run", "Run · 3 items · No equipment"],
      ].map(([name, detail]) => (
        <div key={name} className="mt-4 rounded-lg border border-line p-4">
          <p className="font-medium">{name}</p>
          <p className="mt-1 text-xs leading-5 text-stone-600">{detail}</p>
          <span className="mt-3 inline-block text-xs text-accent">
            View routine ↗
          </span>
        </div>
      ))}
    </div>
  );
}

export function WorkoutPreview() {
  return (
    <div className="product-frame p-5">
      <p className="ui-eyebrow">Example workout detail</p>
      <h3 className="mt-3 text-xl font-semibold">Lower A</h3>
      <p className="mt-1 text-xs text-stone-600">
        Strength · Your session’s own workout snapshot
      </p>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-semibold">01 / Back squat</p>
        <p className="mt-3 text-sm text-stone-600">
          4 × 5–6 · Controlled, full range
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-stone-600">Rest</dt>
            <dd className="mt-1">2–3 minutes</dd>
          </div>
          <div>
            <dt className="text-stone-600">Target</dt>
            <dd className="mt-1">RPE 7–8</dd>
          </div>
        </dl>
        <span className="mt-4 inline-block rounded-md border border-line px-2 py-1 text-xs text-stone-600">
          Barbell
        </span>
      </div>
      <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-stone-600">
        Changing the source routine leaves this planned session intact.
      </p>
    </div>
  );
}

const LIVE_SETS = [
  { weight: "82.5", reps: 6, done: true },
  { weight: "82.5", reps: 6, done: true },
  { weight: "82.5", reps: 5, done: false },
  { weight: "82.5", reps: 5, done: false },
] as const;

/**
 * The live workout screen (/workout/[id]) mid-session: two sets logged, the
 * third open, the rest timer running. Static markup in the landing styles;
 * it shares no code with the real player.
 */
export function LiveWorkoutPreview() {
  const focused = LIVE_SETS.findIndex((set) => !set.done);
  return (
    <figure
      className="preview-phone product-frame"
      aria-label="Example live workout on a phone: two sets of back squat logged, the third ready to log, last time’s numbers and the rest timer counting down"
    >
      <div aria-hidden="true">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <span className="preview-phone-icon">×</span>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-semibold">Lower A</p>
            <p className="text-[10px] text-stone-600">
              <span className="font-mono tabular-nums">18:42</span> · Saved
            </p>
          </div>
          <span className="preview-phone-icon">≡</span>
        </div>
        <div className="flex gap-1 px-3 py-2">
          {[0.5, 0, 0, 0].map((fill, index) => (
            <span key={index} className="preview-progress">
              <span style={{ width: `${fill * 100}%` }} />
            </span>
          ))}
        </div>

        <div className="px-4 pb-4 pt-2">
          <p className="ui-eyebrow">Exercise 1 of 4</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">Back squat</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {["4 × 5–6", "RPE 7–8", "Rest 2 min"].map((chip) => (
              <span key={chip} className="rounded-full border border-line px-2 py-0.5 text-[10px] text-stone-600">
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-600">
            Last time <span className="font-semibold tabular-nums text-stone-900">80 kg × 6, 6, 5, 5</span>
          </p>

          <div className="mt-3 space-y-1.5">
            {LIVE_SETS.map((set, index) =>
              index === focused ? (
                <div key={index} className="rounded-2xl border border-stone-300 bg-card p-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold">
                      Set {index + 1} <span className="font-normal text-stone-500">of {LIVE_SETS.length}</span>
                    </span>
                    <span className="text-stone-600">Target 5–6</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      ["Weight (kg)", set.weight],
                      ["Reps", `${set.reps}`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-600">{label}</p>
                        <p className="preview-stepper">
                          <span>−</span>
                          <strong>{value}</strong>
                          <span>+</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2.5 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-sm font-semibold text-white">
                    ✓ Log set
                  </p>
                </div>
              ) : (
                <p
                  key={index}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm tabular-nums ${
                    set.done ? "bg-emerald-50 font-semibold text-emerald-900" : "text-stone-600"
                  }`}
                >
                  <span className={`preview-set-dot ${set.done ? "preview-set-done" : ""}`}>
                    {set.done ? "✓" : index + 1}
                  </span>
                  {set.weight} kg × {set.reps}
                  <span className="ml-auto text-[10px] font-normal text-stone-500">{set.done ? "Edit" : ""}</span>
                </p>
              ),
            )}
          </div>
        </div>

        <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl border border-line bg-background p-2.5 shadow-sm">
          <span className="preview-rest-ring">
            <svg viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" />
              <circle cx="20" cy="20" r="16" pathLength="100" strokeDasharray="100" strokeDashoffset="30" />
            </svg>
            <strong>1:24</strong>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Rest</span>
            <span className="block truncate text-[10px] text-stone-600">Next: set 3 of Back squat</span>
          </span>
          <span className="text-xs font-medium tabular-nums text-stone-700">+15</span>
          <span className="rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white">Skip</span>
        </div>
      </div>
    </figure>
  );
}
