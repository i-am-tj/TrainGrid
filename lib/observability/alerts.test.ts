import { describe, expect, it } from "vitest";
import { alertMessage, alertWebhook, buildErrorReport, createThrottle } from "./alerts";

const now = new Date("2026-11-18T09:00:00Z");

describe("buildErrorReport", () => {
  it("keeps the framework route, method, class name and digest", () => {
    const error = Object.assign(new TypeError("leaked: member@example.test"), { digest: "123456789" });
    const report = buildErrorReport(
      error,
      { path: "/library?q=private+search", method: "get" },
      { routePath: "/library", routeType: "render" },
      now,
    );
    expect(report).toEqual({
      at: "2026-11-18T09:00:00.000Z",
      route: "/library",
      method: "GET",
      kind: "render",
      error: "TypeError",
      digest: "123456789",
    });
    expect(JSON.stringify(report)).not.toContain("member@example.test");
  });

  it("omits member handles and search terms from both reporting destinations", () => {
    const report = buildErrorReport(
      new Error("private-message"),
      { path: "/people/qa-synthetic-person?q=private-search", method: "GET" },
      { routePath: "/people/[username]", routeType: "render" },
      now,
    );
    for (const output of [report, alertMessage(report)]) {
      const json = JSON.stringify(output);
      expect(json).toContain("/people/[username]");
      expect(json).not.toMatch(/qa-synthetic-person|private-search|private-message/);
    }
  });

  it("does not trust odd names or digests", () => {
    const odd = Object.assign(new Error("x"), { name: "Bad <name>", digest: "has spaces and <tags>" });
    const report = buildErrorReport(odd, { path: "/", method: "POST" }, { routePath: "/", routeType: "action" }, now);
    expect(report.error).toBe("Error");
    expect(report.digest).toBeNull();
    expect(buildErrorReport("thrown string", { path: "/", method: "GET" }, { routePath: "/", routeType: "route" }, now).error).toBe("Error");
  });
});

describe("alertWebhook", () => {
  it("accepts only an https URL", () => {
    expect(alertWebhook({ TRAINGRID_ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" })).toBe(
      "https://hooks.slack.com/services/T/B/X",
    );
    expect(alertWebhook({ TRAINGRID_ALERT_WEBHOOK_URL: "http://example.com/hook" })).toBeNull();
    expect(alertWebhook({ TRAINGRID_ALERT_WEBHOOK_URL: "not a url" })).toBeNull();
    expect(alertWebhook({})).toBeNull();
  });
});

describe("createThrottle", () => {
  it("alerts once per error per window", () => {
    const allow = createThrottle(1000);
    expect(allow("TypeError /home", 0)).toBe(true);
    expect(allow("TypeError /home", 500)).toBe(false);
    expect(allow("TypeError /library", 600)).toBe(true);
    expect(allow("TypeError /home", 1000)).toBe(true);
  });
});

describe("alertMessage", () => {
  it("is one readable line for Slack and Discord", () => {
    const report = buildErrorReport(new Error("x"), { path: "/home", method: "GET" }, { routePath: "/home", routeType: "render" }, now);
    const message = alertMessage(report);
    expect(message.text).toBe("TrainGrid server error: Error on GET /home (render) · 2026-11-18T09:00:00.000Z");
    expect(message.content).toBe(message.text);
  });
});
