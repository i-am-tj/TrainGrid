import { DataError } from "@/lib/data/model";

/**
 * The social layer needs its migration (20261122000000_social). If the app is
 * deployed before that migration reaches the database, the API answers with
 * "table/function not found" instead of data. Those errors are turned into a
 * SocialUnavailableError, so social pages can say so calmly (and the rest of
 * TrainGrid, including the data download, keeps working) instead of failing
 * with a server error.
 */

export const SOCIAL_UNAVAILABLE_MESSAGE =
  "Social features aren’t available right now. Your plan is safe; please try again later.";

export class SocialUnavailableError extends DataError {
  constructor() {
    super("unavailable", SOCIAL_UNAVAILABLE_MESSAGE);
    this.name = "SocialUnavailableError";
  }
}

/**
 * Error codes meaning "this table, function or schema does not exist here":
 * PostgREST's schema-cache misses (PGRST205 table, PGRST202 function) and the
 * Postgres equivalents (undefined table, undefined function, unknown schema).
 */
const MISSING_SCHEMA_CODES: ReadonlySet<string> = new Set(["PGRST205", "PGRST202", "42P01", "42883", "3F000"]);

export function isMissingSchemaError(error: { code?: string | null } | null | undefined): boolean {
  return typeof error?.code === "string" && MISSING_SCHEMA_CODES.has(error.code);
}

/** The error to throw for a failed social query: "unavailable" when the schema is missing, else a plain error. */
export function socialFailure(error: { code?: string | null } | null | undefined, message: string): Error {
  return isMissingSchemaError(error) ? new SocialUnavailableError() : new Error(message);
}
