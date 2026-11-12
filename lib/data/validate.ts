import type { z } from "zod";
import { DataError } from "./model";

/** Parses input with a schema, turning a failure into a DataError("invalid"). */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new DataError("invalid", first?.message ?? "Invalid input");
  }
  return result.data;
}
