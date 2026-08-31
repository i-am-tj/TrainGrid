import { EQUIPMENT_LABELS } from "@/lib/domain";
import { parseWorkoutItems } from "@/lib/workout-items";
import { MarkdownBody } from "@/components/MarkdownBody";

export function WorkoutItemsView({ markdown }: { markdown: string }) {
  const items = parseWorkoutItems(markdown);
  if (items.length === 0) {
    return <MarkdownBody markdown={markdown} />;
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <section key={item.id}>
          {item.title ? (
            <h2 className="text-base font-semibold text-stone-900">{item.title}</h2>
          ) : null}
          {item.body ? <MarkdownBody markdown={item.body} /> : null}
          {item.equipment.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
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
