"use client";

import { useActionState } from "react";
import { importBackupAction } from "@/lib/actions";
import { btnSecondary } from "@/lib/ui";

export function ImportExport() {
  const [state, action] = useActionState(importBackupAction, null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href="/api/export" className={btnSecondary}>
        Export
      </a>
      <form action={action}>
        <label className={`${btnSecondary} cursor-pointer`}>
          Import
          <input
            type="file"
            name="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const input = event.currentTarget;
              const form = input.form;
              if (!form || !input.files?.length) return;
              if (
                confirm(
                  "Import replaces all templates and scheduled sessions. Continue?",
                )
              ) {
                form.requestSubmit();
              } else {
                input.value = "";
              }
            }}
          />
        </label>
      </form>
      {state?.error ? (
        <p role="alert" className="text-xs text-red-800">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
