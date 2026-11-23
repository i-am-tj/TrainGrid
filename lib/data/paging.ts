/**
 * Reads every row of a query, page by page.
 *
 * The Data API caps each response (`max_rows`, 1000 by default) without
 * saying so, so a plain select silently stops at the cap. A download must be
 * complete, so it pages with `.range()` until a short page. The query must
 * have a total, stable order (end with a unique column such as `id`), or rows
 * could repeat or go missing between pages.
 *
 * The page size stays below the default cap, so a full page always means
 * "maybe more" rather than "the server cut it here".
 */
export const PAGE_SIZE = 500;

export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
