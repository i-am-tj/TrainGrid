"use client";
import { useFormStatus } from "react-dom";
import { btnPrimary } from "@/lib/ui";

/** Pending feedback only; the surrounding form keeps its existing action and confirmation. */
export function ActionSubmit({
  label,
  busy,
  className = btnPrimary,
  disabled = false,
}: {
  label: string;
  busy: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      aria-busy={pending}
      disabled={disabled || pending}
      className={className}
    >
      {pending ? busy : label}
    </button>
  );
}
