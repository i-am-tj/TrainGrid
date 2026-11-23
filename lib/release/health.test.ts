import { afterEach, expect, it, vi } from "vitest";
import manifest from "./schema-manifest.json";
import * as schema from "./schema";
import { GET } from "@/app/api/health/route";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("shares a cold schema read, retries a failure and refreshes after expiry", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "local-test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "local-test");
  const auth = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", auth);
  const read = vi.spyOn(schema, "fetchSchemaShape").mockRejectedValue(new Error("temporary outage"));

  const concurrent = await Promise.all([GET(), GET(), GET(), GET()]);
  for (const response of concurrent) {
    expect(await response.json()).toEqual({ supabase: "ok", schema: "unknown" });
  }
  expect(read).toHaveBeenCalledTimes(1);

  read.mockResolvedValue(manifest);
  const recovered = await GET();
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ supabase: "ok", schema: "ok" });
  await GET();
  expect(read).toHaveBeenCalledTimes(2);

  vi.setSystemTime(Date.now() + 5 * 60_000);
  await Promise.all([GET(), GET()]);
  expect(read).toHaveBeenCalledTimes(3);
  expect(auth).toHaveBeenCalledTimes(8);
});
