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
        <span className="text-xs text-stone-500">Example training week</span>
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
      <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-stone-500">
        <span>Monday–Sunday. Timed or untimed.</span>
        <span aria-hidden="true">↗</span>
      </div>
    </figure>
  );
}

export function AgendaPreview() {
  return (
    <div className="product-frame mx-auto max-w-xs p-5">
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full bg-line"
        aria-hidden="true"
      />
      <p className="ui-eyebrow">Wednesday · Example agenda</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">
        A little structure.
        <br />A lot of freedom.
      </h3>
      <div className="mt-6 border-l-2 border-accent pl-4">
        <p className="text-xs text-stone-500">07:00 · Running · 45 min</p>
        <p className="mt-2 font-semibold">Intervals</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Warm up, find your rhythm, then 6 × 400m.
        </p>
        <span className="mt-4 inline-block text-xs text-accent">
          Open planned workout ↗
        </span>
      </div>
      <p className="mt-8 border-t border-line pt-4 text-xs text-stone-500">
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
        <span className="px-4 py-2 text-stone-500">TrainGrid</span>
        <span className="px-4 py-2 text-stone-500">Mine</span>
      </div>
      {[
        ["Lower A", "Lift · 5 items · Barbell, Dumbbell"],
        ["Easy run", "Run · 3 items · No equipment"],
      ].map(([name, detail]) => (
        <div key={name} className="mt-4 rounded-lg border border-line p-4">
          <p className="font-medium">{name}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">{detail}</p>
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
      <p className="mt-1 text-xs text-stone-500">
        Strength · Your session’s own workout snapshot
      </p>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-semibold">01 / Back squat</p>
        <p className="mt-3 text-sm text-stone-600">
          4 × 5–6 · Controlled, full range
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-stone-500">Rest</dt>
            <dd className="mt-1">2–3 minutes</dd>
          </div>
          <div>
            <dt className="text-stone-500">Target</dt>
            <dd className="mt-1">RPE 7–8</dd>
          </div>
        </dl>
        <span className="mt-4 inline-block rounded-md border border-line px-2 py-1 text-xs text-stone-600">
          Barbell
        </span>
      </div>
      <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-stone-500">
        Changing the source routine leaves this planned session intact.
      </p>
    </div>
  );
}
