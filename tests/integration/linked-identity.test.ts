import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { savePersonalRoutine } from "@/lib/data/routines";
import {
  createTestUser,
  deleteTestUsers,
  integrationReady,
  linkGoogleIdentity,
  localSql,
  service,
  type TestUser,
} from "./helpers";

/**
 * Identity approval at the authorization boundary (E2-D22, PR #28 review).
 *
 * Everything here talks to Supabase directly — the auth server for tokens,
 * the REST API for data, the publishable key only — exactly as a client that
 * never goes through the Next.js callback would. The local stack runs the
 * custom access token hook (supabase/config.toml).
 *
 * Signing in "through a linked identity": Supabase Auth records the identity
 * of every OAuth sign-in in the user's metadata (`sub`) before issuing tokens,
 * and the hook reads that. Real Google cannot run against the local stack, so
 * the tests set the same metadata and take the token from the auth server's
 * password grant; the hook sees the same input either way.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const fresh = () =>
  createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
/** A client that uses only a raw access token, as a script would. */
const withToken = (token: string) =>
  createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

describe.skipIf(!integrationReady)("identity approval: direct Supabase access", () => {
  let member: TestUser;
  let password: string;
  let routineId: string;

  /** Records, as Supabase Auth does, which identity the next sign-in uses. */
  const signInVia = async (providerId: string) => {
    await service().auth.admin.updateUserById(member.id, { user_metadata: { sub: providerId } });
    const client = fresh();
    const result = await client.auth.signInWithPassword({ email: member.email, password });
    return { client, ...result };
  };
  const ownRoutine = async (client: ReturnType<typeof fresh>) =>
    (await client.from("routines").select("id").eq("id", routineId)).data ?? [];

  beforeAll(async () => {
    member = await createTestUser("approval");
    routineId = await savePersonalRoutine(member.db, null, {
      name: "Private routine",
      category: "strength",
      items: [{ name: "Squat", instruction: "5 × 5" }],
    });
    password = `local-${crypto.randomUUID()}`;
    await service().auth.admin.updateUserById(member.id, { password });
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  it("a sign-in through an unapproved linked identity gets no token at all", async ({ skip }) => {
    const alias = `alias-${crypto.randomUUID()}@example.test`;
    const providerId = linkGoogleIdentity(member.id, alias);
    if (!providerId) skip();
    // An invitation for the alias changes nothing either way (requirement: no
    // reliance on pending invitations).
    await service().from("invitations").insert({ email: alias });

    const attempt = await signInVia(providerId!);
    expect(attempt.data.session).toBeNull();
    expect(attempt.error?.status).toBe(403);
    expect(attempt.error?.message).toBe("identity_not_approved");

    await service().from("invitations").delete().eq("email", alias);
  });

  it("the member's own identity still signs in and reads their data", async () => {
    const own = await signInVia(member.id); // the email identity's provider id is the user id
    expect(own.error).toBeNull();
    expect(await ownRoutine(own.client)).toHaveLength(1);
  });

  it("a linked identity with the same address is approved automatically", async ({ skip }) => {
    const providerId = linkGoogleIdentity(member.id, member.email);
    if (!providerId) skip();
    const same = await signInVia(providerId!);
    expect(same.error).toBeNull();
    expect(await ownRoutine(same.client)).toHaveLength(1);
  });

  it("approved by the member, a linked identity works; unlinked, its session is cut off at once", async ({ skip }) => {
    const alias = `github-${crypto.randomUUID()}@example.test`;
    const providerId = linkGoogleIdentity(member.id, alias);
    if (!providerId) skip();

    // The member, on their own approved and recent session, approves it.
    const owner = await signInVia(member.id);
    const identities = await owner.client.auth.getUserIdentities();
    const linked = identities.data!.identities.find((i) => i.id === providerId || i.identity_data?.sub === providerId)!;
    expect(linked).toBeDefined();
    const approval = await owner.client.rpc("approve_my_identity", { p_identity_id: linked.identity_id });
    expect(approval.data).toBe("approved");

    const viaLinked = await signInVia(providerId!);
    expect(viaLinked.error).toBeNull();
    expect(await ownRoutine(viaLinked.client)).toHaveLength(1);
    const linkedToken = viaLinked.data.session!.access_token;

    // The member removes it with Supabase Auth's own unlinkIdentity().
    const unlinked = await owner.client.auth.unlinkIdentity(linked);
    expect(unlinked.error).toBeNull();

    // The access token is still unexpired, but the database refuses it now...
    expect(await ownRoutine(withToken(linkedToken))).toHaveLength(0);
    // ... and the auth server will not refresh it.
    const refresh = await viaLinked.client.auth.refreshSession();
    expect(refresh.data.session).toBeNull();
    expect(refresh.error?.status).toBe(403);
  });

  it("a signed-out session's access token stops working immediately", async () => {
    const session = await signInVia(member.id);
    const token = session.data.session!.access_token;
    expect(await ownRoutine(withToken(token))).toHaveLength(1);
    await session.client.auth.signOut({ scope: "local" });
    expect(await ownRoutine(withToken(token))).toHaveLength(0);
  });

  it("a session with no identity record (as from before this change) is refused and not refreshed", async ({ skip }) => {
    const session = await signInVia(member.id);
    const token = session.data.session!.access_token;
    const sessionId = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).session_id as string;
    if (!/^[0-9a-f-]{36}$/.test(sessionId) || !localSql(`delete from public.session_identities where session_id = '${sessionId}';`)) skip();

    expect(await ownRoutine(withToken(token))).toHaveLength(0);
    const refresh = await session.client.auth.refreshSession();
    expect(refresh.error?.status).toBe(403);
  });

  it("the gate cannot be skipped: no token means no REST access, whatever the client", async ({ skip }) => {
    const alias = `skip-${crypto.randomUUID()}@example.test`;
    const providerId = linkGoogleIdentity(member.id, alias);
    if (!providerId) skip();
    const attempt = await signInVia(providerId!);
    expect(attempt.data.session).toBeNull();
    // Nothing to call the REST API with; the anonymous key alone sees nothing private.
    expect(await ownRoutine(fresh())).toHaveLength(0);
  });
});
