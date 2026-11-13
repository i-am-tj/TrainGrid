import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { savePersonalRoutine } from "@/lib/data/routines";
import { scheduleRoutine } from "@/lib/data/sessions";
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
 * Canonical email rule at the authorization boundary (E2-D22).
 *
 * Everything talks to Supabase directly — the auth server for tokens, the REST
 * API for data, the publishable key only — exactly as a client that never goes
 * through the Next.js app would. Nothing depends on which identity a session
 * came from: Supabase Auth issues sessions per user, and the only per-sign-in
 * signal (user metadata) is user-editable, so the rule looks only at the
 * account's identities and whether the session still exists.
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

describe.skipIf(!integrationReady)("canonical email rule: direct Supabase access", () => {
  let member: TestUser;
  let password: string;
  let routineId: string;

  const signIn = async () => {
    const client = fresh();
    const result = await client.auth.signInWithPassword({ email: member.email, password });
    if (result.error || !result.data.session) throw new Error(`sign-in failed: ${result.error?.message}`);
    return { client, token: result.data.session.access_token };
  };
  const ownRoutine = async (client: ReturnType<typeof fresh>) =>
    (await client.from("routines").select("id").eq("id", routineId)).data ?? [];
  /** Puts the account back: only identities on the invited address remain. */
  const removeIdentitiesExceptEmail = () =>
    localSql(`delete from auth.identities where user_id = '${member.id}' and email <> lower('${member.email}');`);
  /** What a session can read through REST, table by table. */
  const visible = async (client: ReturnType<typeof fresh>) => ({
    routines: ((await client.from("routines").select("id").eq("owner_user_id", member.id)).data ?? []).length,
    items: ((await client.from("workout_items").select("id").eq("routine_id", routineId)).data ?? []).length,
    sessions: ((await client.from("scheduled_sessions").select("id").eq("user_id", member.id)).data ?? []).length,
    profiles: ((await client.from("profiles").select("id").eq("id", member.id)).data ?? []).length,
  });
  const ALL = { routines: 1, items: 1, sessions: 1, profiles: 1 };
  const NONE = { routines: 0, items: 0, sessions: 0, profiles: 0 };

  beforeAll(async () => {
    member = await createTestUser("canonical");
    routineId = await savePersonalRoutine(member.db, null, {
      name: "Private routine",
      category: "strength",
      items: [{ name: "Squat", instruction: "5 × 5" }],
    });
    await scheduleRoutine(member.db, member.id, { routineId, date: "2026-11-16" });
    password = `local-${crypto.randomUUID()}`;
    await service().auth.admin.updateUserById(member.id, { password });
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  it("a member whose identities all use the invited address reads their data", async () => {
    const { client } = await signIn();
    expect((await client.rpc("account_status")).data).toBe("member");
    expect(await ownRoutine(client)).toHaveLength(1);
  });

  it("a linked identity on another address locks every session, including tokens already issued", async ({ skip }) => {
    const before = await signIn(); // issued while the account was consistent
    expect(await ownRoutine(before.client)).toHaveLength(1);

    if (!linkGoogleIdentity(member.id, `alias-${crypto.randomUUID()}@example.test`)) skip();

    // The token issued earlier: refused on the very next query.
    expect(await ownRoutine(withToken(before.token))).toHaveLength(0);
    // A brand-new session (whatever identity it came from): refused too.
    const after = await signIn();
    expect((await after.client.rpc("account_status")).data).toBe("identity_mismatch");
    expect(await ownRoutine(after.client)).toHaveLength(0);
    expect((await after.client.from("routines").select("id").eq("scope", "GLOBAL")).data).toHaveLength(0);
    // Refresh still issues tokens, but they read nothing either.
    const refreshed = await after.client.auth.refreshSession();
    expect(await ownRoutine(withToken(refreshed.data.session!.access_token))).toHaveLength(0);

    removeIdentitiesExceptEmail();
  });

  it("user metadata cannot talk the database round: no attribution is used", async ({ skip }) => {
    const providerId = linkGoogleIdentity(member.id, `meta-${crypto.randomUUID()}@example.test`);
    if (!providerId) skip();
    const { client } = await signIn();
    // A session can rewrite its own metadata (Supabase allows it); it makes no difference.
    const edited = await client.auth.updateUser({ data: { sub: member.id, provider_id: member.id } });
    expect(edited.error).toBeNull();
    const again = await client.auth.refreshSession();
    expect(await ownRoutine(withToken(again.data.session!.access_token))).toHaveLength(0);
    removeIdentitiesExceptEmail();
  });

  it("removing the stray identity with unlinkIdentity() restores the owner; signing out others ends theirs at once", async ({ skip }) => {
    const stray = await signIn(); // a session the cleanup must end
    const providerId = linkGoogleIdentity(member.id, `stray-${crypto.randomUUID()}@example.test`);
    if (!providerId) skip();

    const owner = await signIn();
    const identities = await owner.client.auth.getUserIdentities();
    const linked = identities.data!.identities.find((i) => i.id === providerId)!;
    expect(linked).toBeDefined();
    const unlinked = await owner.client.auth.unlinkIdentity(linked);
    expect(unlinked.error).toBeNull();

    expect(await ownRoutine(owner.client)).toHaveLength(1);
    // Without the next step the other session would regain access too:
    expect(await ownRoutine(withToken(stray.token))).toHaveLength(1);

    await owner.client.auth.signOut({ scope: "others" });
    expect(await ownRoutine(withToken(stray.token))).toHaveLength(0);
    const refresh = await stray.client.auth.refreshSession();
    expect(refresh.data.session).toBeNull();
    expect(await ownRoutine(owner.client)).toHaveLength(1);
  });

  it("cleanup in the runbook's order: REST on every member table, before and after", async ({ skip }) => {
    const owner = await signIn();
    expect(await visible(owner.client)).toEqual(ALL);

    // A stray identity is linked and a session is opened through it.
    const providerId = linkGoogleIdentity(member.id, `cleanup-${crypto.randomUUID()}@example.test`);
    if (!providerId) skip();
    const stray = await signIn();
    expect(await visible(owner.client)).toEqual(NONE);
    expect(await visible(stray.client)).toEqual(NONE);

    // 1. While still locked, sign out every other device: the stray session ends.
    await owner.client.auth.signOut({ scope: "others" });
    expect(await visible(withToken(stray.token))).toEqual(NONE);
    expect((await stray.client.auth.refreshSession()).data.session).toBeNull();

    // A sign-in that slips in during the window (why the window must be controlled) ...
    const late = await signIn();

    // 2. Remove the last mismatched identity.
    const identities = await owner.client.auth.getUserIdentities();
    const linked = identities.data!.identities.find((i) => i.id === providerId)!;
    expect((await owner.client.auth.unlinkIdentity(linked)).error).toBeNull();
    expect(await visible(owner.client)).toEqual(ALL);
    // ... regains access once the account is consistent:
    expect(await visible(withToken(late.token))).toEqual(ALL);

    // 3. Verify and revoke other sessions again.
    await owner.client.auth.signOut({ scope: "others" });
    expect(await visible(withToken(late.token))).toEqual(NONE);
    expect(await visible(withToken(stray.token))).toEqual(NONE);
    expect(await visible(owner.client)).toEqual(ALL);
  });

  it("an account with no Google or GitHub identity on its invited address is locked", async ({ skip }) => {
    if (!localSql(`delete from auth.identities where user_id = '${member.id}' and provider in ('google', 'github');`)) skip();
    const { client } = await signIn();
    expect((await client.rpc("account_status")).data).toBe("identity_mismatch");
    expect(await visible(client)).toEqual(NONE);
    if (!linkGoogleIdentity(member.id, member.email)) skip();
    expect(await visible(client)).toEqual(ALL);
  });

  it("a linked identity on the same address is fine", async ({ skip }) => {
    if (!linkGoogleIdentity(member.id, member.email)) skip();
    const { client } = await signIn();
    expect(await ownRoutine(client)).toHaveLength(1);
    removeIdentitiesExceptEmail();
  });

  it("a signed-out session's access token stops working immediately", async () => {
    const { client, token } = await signIn();
    expect(await ownRoutine(withToken(token))).toHaveLength(1);
    await client.auth.signOut({ scope: "local" });
    expect(await ownRoutine(withToken(token))).toHaveLength(0);
  });

  it("the stored canonical email decides, not the account email a user may change", async ({ skip }) => {
    const alias = `moved-${crypto.randomUUID()}@example.test`;
    // The account email moves to the alias, and an identity for the alias is linked.
    await service().auth.admin.updateUserById(member.id, { email: alias, email_confirm: true });
    if (!linkGoogleIdentity(member.id, alias)) skip();
    const { client } = await (async () => {
      const c = fresh();
      const r = await c.auth.signInWithPassword({ email: alias, password });
      return { client: c, error: r.error };
    })();
    expect(await ownRoutine(client)).toHaveLength(0);
    removeIdentitiesExceptEmail();
    await service().auth.admin.updateUserById(member.id, { email: member.email, email_confirm: true });
  });
});
