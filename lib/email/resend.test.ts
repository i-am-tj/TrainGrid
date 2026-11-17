import { describe, expect, it, vi } from "vitest";
import { isValidFromAddress, normalizeFromAddress, readEmailConfig, RESEND_API_URL, type EmailConfig } from "./config";
import { classifyStatus, createResendTransport } from "./resend";

const config: EmailConfig = {
  apiKey: "re_test_key",
  apiUrl: RESEND_API_URL,
  from: "TrainGrid <invites@mail.example.com>",
  replyTo: null,
};
const email = {
  to: "alex@example.test",
  subject: "You’re invited to TrainGrid",
  html: "<p>Hi</p>",
  text: "Hi",
  idempotencyKey: "traingrid-invitation-email/abc",
};

describe("readEmailConfig", () => {
  const base = { RESEND_API_KEY: "re_abc123", TRAINGRID_EMAIL_FROM: "TrainGrid <invites@mail.example.com>" };

  it("reads a complete configuration", () => {
    expect(readEmailConfig(base)).toEqual({
      apiKey: "re_abc123",
      apiUrl: RESEND_API_URL,
      from: "TrainGrid <invites@mail.example.com>",
      replyTo: null,
    });
    expect(readEmailConfig({ ...base, TRAINGRID_EMAIL_REPLY_TO: "tj@example.com" })?.replyTo).toBe("tj@example.com");
  });

  it("is not configured when anything is missing or malformed", () => {
    expect(readEmailConfig({})).toBeNull();
    expect(readEmailConfig({ RESEND_API_KEY: "re_abc123" })).toBeNull();
    expect(readEmailConfig({ ...base, RESEND_API_KEY: "sk_live_abc" })).toBeNull();
    expect(readEmailConfig({ ...base, TRAINGRID_EMAIL_FROM: "not an address" })).toBeNull();
    expect(readEmailConfig({ ...base, TRAINGRID_EMAIL_REPLY_TO: "nope" })).toBeNull();
  });

  it("only allows the real API or a local mock as the endpoint", () => {
    expect(readEmailConfig({ ...base, RESEND_API_URL: "http://127.0.0.1:3011" })?.apiUrl).toBe("http://127.0.0.1:3011");
    expect(readEmailConfig({ ...base, RESEND_API_URL: "https://evil.example" })).toBeNull();
    expect(readEmailConfig({ ...base, RESEND_API_URL: "http://evil.example" })).toBeNull();
  });

  it("validates the From header and refuses header injection", () => {
    expect(isValidFromAddress("invites@mail.example.com")).toBe(true);
    expect(isValidFromAddress("TrainGrid <invites@mail.example.com>")).toBe(true);
    expect(isValidFromAddress("TrainGrid\r\nBcc: x@y.z <invites@mail.example.com>")).toBe(false);
    expect(isValidFromAddress('"Evil" <x@y>')).toBe(false);
    expect(isValidFromAddress("<invites@mail.example.com>")).toBe(false);
    expect(isValidFromAddress("TrainGrid <not an address>")).toBe(false);
  });

  it("accepts a From with no space before < and normalises it", () => {
    const from = "TrainGrid Invites<invites@traingrid.example.com>";
    expect(normalizeFromAddress(from)).toBe("TrainGrid Invites <invites@traingrid.example.com>");
    expect(readEmailConfig({ ...base, TRAINGRID_EMAIL_FROM: from })?.from).toBe(
      "TrainGrid Invites <invites@traingrid.example.com>",
    );
    expect(normalizeFromAddress("TrainGrid Invites   <invites@traingrid.example.com>")).toBe(
      "TrainGrid Invites <invites@traingrid.example.com>",
    );
  });
});

describe("createResendTransport", () => {
  it("posts one email with the idempotency key and returns the provider id", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "msg_123" }));
    const result = await createResendTransport(config, fetchImpl as unknown as typeof fetch)(email);
    expect(result).toEqual({ ok: true, messageId: "msg_123" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Idempotency-Key"]).toBe("traingrid-invitation-email/abc");
    expect(JSON.parse(init.body as string)).toEqual({
      from: config.from,
      to: ["alex@example.test"],
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  });

  it("classifies provider failures without returning their body", async () => {
    for (const [status, code] of [
      [401, "provider_auth"],
      [403, "provider_auth"],
      [422, "provider_rejected"],
      [429, "rate_limited"],
      [500, "provider_unavailable"],
      [503, "provider_unavailable"],
    ] as const) {
      expect(classifyStatus(status)).toBe(code);
      const fetchImpl = async () => Response.json({ message: "secret diagnostics" }, { status });
      const result = await createResendTransport(config, fetchImpl as unknown as typeof fetch)(email);
      expect(result).toEqual({ ok: false, code, status });
      expect(JSON.stringify(result)).not.toContain("secret diagnostics");
    }
  });

  it("reports network errors and timeouts as failures", async () => {
    const network = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await createResendTransport(config, network as unknown as typeof fetch)(email)).toEqual({
      ok: false,
      code: "provider_unavailable",
      status: null,
    });

    const slow = (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    expect(await createResendTransport(config, slow as unknown as typeof fetch, 20)(email)).toEqual({
      ok: false,
      code: "timeout",
      status: null,
    });
  });

  it("treats a 2xx without an id as accepted", async () => {
    const fetchImpl = async () => new Response("", { status: 200 });
    expect(await createResendTransport(config, fetchImpl as unknown as typeof fetch)(email)).toEqual({
      ok: true,
      messageId: null,
    });
  });
});
