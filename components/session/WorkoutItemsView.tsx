import { EQUIPMENT_LABELS } from "@/lib/domain";
import type { PlannedItem } from "@/lib/data/model";

/** Read-only view of planned workout items. Plain text; no Markdown. */
export function WorkoutItemsView({ items }: { items: PlannedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-600">No workout items.</p>;
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <section key={item.id}>
          <h2 className="text-base font-semibold text-stone-900">{item.name}</h2>
          {item.instruction ? (
            <p className="mt-1 whitespace-pre-line text-sm text-stone-800">{item.instruction}</p>
          ) : null}
          {item.rest || item.target ? (
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-700">
              {item.rest ? (
                <div className="flex gap-1">
                  <dt className="font-medium">Rest:</dt>
                  <dd>{item.rest}</dd>
                </div>
              ) : null}
              {item.target ? (
                <div className="flex gap-1">
                  <dt className="font-medium">Target:</dt>
                  <dd>{item.target}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {item.notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{item.notes}</p>
          ) : null}
          {item.equipment.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Equipment">
              {item.equipment.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-line bg-stone-50 px-2 py-0.5 text-xs text-stone-700"
                >
                  {EQUIPMENT_LABELS[tag]}
                </li>
              ))}
            </ul>
          ) : null}
          {item.videoUrl ? (
            <p className="mt-2">
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-stone-900 underline"
              >
                ▶ Watch demo
              </a>
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
