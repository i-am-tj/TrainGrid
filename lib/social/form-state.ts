/** What a social form action answers with, for useActionState. */
export type FormState = { status: "idle" | "done" | "error"; message: string | null };

export const IDLE: FormState = { status: "idle", message: null };
