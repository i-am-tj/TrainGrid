import type { Instrumentation } from "next";
import { alertMessage, alertWebhook, buildErrorReport, createThrottle } from "@/lib/observability/alerts";

/**
 * Server error reporting: one structured, data-free log line per error
 * (searchable in Vercel's logs), and an alert to TRAINGRID_ALERT_WEBHOOK_URL
 * when it is set (lib/observability/alerts.ts). Reporting never throws.
 */
const shouldAlert = createThrottle();

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    const report = buildErrorReport(error, request, context, new Date());
    console.error(JSON.stringify({ event: "server_error", ...report }));

    const webhook = alertWebhook();
    if (!webhook || !shouldAlert(`${report.error} ${report.route} ${report.digest ?? ""}`, Date.now())) return;
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertMessage(report)),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
  } catch {
    // Reporting must never make an error worse.
  }
};
