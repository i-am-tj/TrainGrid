/**
 * The TrainGrid mark: a week grid with a rising diagonal, the top cell in
 * amber — planned sessions building towards a goal. Decorative wherever the
 * name "TrainGrid" is next to it, so it is hidden from assistive technology.
 * The same drawing is exported as public/brand/traingrid-logo.svg and as PNGs
 * for the Google Auth Platform branding page (docs/BRANDING.md).
 */
export function BrandLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="#1c1917" />
      {CELLS.map(([x, y, tone]) => (
        <rect
          key={`${x}-${y}`}
          x={5 + x * 8}
          y={5 + y * 8}
          width="6"
          height="6"
          rx="1.5"
          fill={tone === "goal" ? "#f59e0b" : "#fffcf7"}
          fillOpacity={tone === "idle" ? 0.22 : 1}
        />
      ))}
    </svg>
  );
}

type Tone = "idle" | "done" | "goal";

/** [column, row, tone] — the diagonal runs from bottom left to the amber top right. */
const CELLS: Array<[number, number, Tone]> = [
  [0, 0, "idle"],
  [1, 0, "idle"],
  [2, 0, "goal"],
  [0, 1, "idle"],
  [1, 1, "done"],
  [2, 1, "idle"],
  [0, 2, "done"],
  [1, 2, "idle"],
  [2, 2, "idle"],
];
