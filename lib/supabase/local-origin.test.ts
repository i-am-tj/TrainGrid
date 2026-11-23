import { expect, it } from "vitest";
import { isLocalSupabaseOrigin } from "./local-origin";

it("accepts local CLI ports and rejects other targets before a client is created", () => {
  for (const url of ["http://127.0.0.1:54321", "http://localhost:56321/"]) {
    expect(isLocalSupabaseOrigin(url)).toBe(true);
  }
  for (const url of ["", "https://project.example.test", "http://localhost:65536", "http://localhost:54321/path", "http://127.0.0.1:missing"]) {
    expect(isLocalSupabaseOrigin(url)).toBe(false);
  }
});
