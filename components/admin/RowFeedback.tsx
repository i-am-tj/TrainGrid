"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type RowFeedbackMessage = {
  tone: "success" | "warning" | "error";
  message: string;
  /** Marks email outcomes, so tests and styles can tell them apart. */
  email?: boolean;
};

type Setter = (feedback: RowFeedbackMessage | null) => void;

const RowFeedbackContext = createContext<{
  feedback: RowFeedbackMessage | null;
  setFeedback: Setter;
} | null>(null);

/**
 * Lets the compact action buttons of one list row report their outcome on a
 * full-width line under the row, instead of inside the narrow actions column.
 */
export function RowFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<RowFeedbackMessage | null>(null);
  return (
    <RowFeedbackContext.Provider value={{ feedback, setFeedback }}>
      {children}
    </RowFeedbackContext.Provider>
  );
}

/** The row's reporter, or null when the form is used outside a list row. */
export function useRowFeedback(): Setter | null {
  return useContext(RowFeedbackContext)?.setFeedback ?? null;
}

const STYLE: Record<RowFeedbackMessage["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function RowFeedbackOutlet({ className = "" }: { className?: string }) {
  const feedback = useContext(RowFeedbackContext)?.feedback ?? null;
  // The live region stays mounted so screen readers announce new messages.
  return (
    <div aria-live="polite" aria-atomic="true" className={className}>
      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          data-email-feedback={feedback.email ? feedback.tone : undefined}
          className={`rounded-lg border px-3 py-2 text-xs leading-5 ${STYLE[feedback.tone]}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
