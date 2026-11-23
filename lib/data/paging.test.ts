import { describe, expect, it } from "vitest";
import { readAllPages } from "./paging";

function table(count: number) {
  const rows = Array.from({ length: count }, (_, index) => index);
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, calls };
}

describe("readAllPages", () => {
  it("reads past one page, in order, and stops on a short page", async () => {
    const { page, calls } = table(7);
    expect(await readAllPages(page, 3)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(calls).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
  });

  it("asks once more after an exactly full last page", async () => {
    const { page, calls } = table(6);
    expect(await readAllPages(page, 3)).toHaveLength(6);
    expect(calls).toHaveLength(3);
  });

  it("returns nothing for an empty table, and throws a page's error", async () => {
    expect(await readAllPages(table(0).page, 3)).toEqual([]);
    const failure = new Error("boom");
    await expect(readAllPages(async () => ({ data: null, error: failure }), 3)).rejects.toBe(failure);
  });
});
