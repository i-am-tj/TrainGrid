import { expect, test, type Page } from "@playwright/test";
import {
  createAcceptedInvitation,
  createLocalRoutineFor,
  createLocalSessionFor,
  deleteLocalInvitations,
  hasLocalSecretKey,
  makeLocalMember,
  readRows,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
  signInAsNewLocalUser,
  supabaseState,
} from "./local-supabase";
import { createRoutine, scheduleRoutine } from "./planner-helpers";

/**
 * Cross-user authorization through the running application (story 28).
 *
 * The database and data-layer suites already prove isolation for direct
 * queries. These tests attack the app itself: member A takes one of their
 * own real forms, swaps in the id of member B's row (or adds ownership
 * fields), and submits it to the real server action. Then the database is
 * read as the service role to show B's data is untouched.
 */

const ERROR_HEADING = "Could not complete that action";

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

/** Sets every hidden input with this name on the page. */
async function forge(page: Page, name: string, value: string) {
  await page.locator(`input[type="hidden"][name="${name}"]`).evaluateAll(
    (inputs, v) => inputs.forEach((input) => ((input as HTMLInputElement).value = v)),
    value,
  );
}

/** Adds a hidden field to the form that submits with this button, as a crafted request would. */
async function inject(page: Page, submitLabel: string, name: string, value: string) {
  const form = page
    .locator("main form, form")
    .filter({ has: page.getByRole("button", { name: submitLabel, exact: true }) });
  await expect(form).toHaveCount(1);
  await form.evaluate(
    (form, [n, v]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = n!;
      input.value = v!;
      form.appendChild(input);
    },
    [name, value],
  );
}

test.describe("member A against member B's data", () => {
  let aId: string;
  let bId: string;
  let bSession: string;
  let bRoutine: string;

  test.beforeEach(async ({ context, browser, baseURL }) => {
    const other = await browser.newContext({ baseURL });
    bId = (await signInAsNewLocalMember(other, baseURL!)).userId;
    await other.close();
    bSession = await createLocalSessionFor(bId, "B private session", "2026-11-16");
    bRoutine = await createLocalRoutineFor(bId, "B private routine");
    aId = (await signInAsNewLocalMember(context, baseURL!)).userId;
  });

  async function bSessionRow() {
    const [row] = await readRows("scheduled_sessions", { id: bSession });
    return row;
  }

  async function bRoutineRow() {
    const [row] = await readRows("routines", { id: bRoutine });
    return row;
  }

  async function openOwnSession(page: Page, suffix = "") {
    await scheduleRoutine(page, "Easy Run", "2", "07:00");
    await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
    await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
    if (suffix) await page.goto(`${page.url()}${suffix}`);
  }

  test("I2: A cannot open B's session, its edit page or its customise page", async ({ page }) => {
    for (const path of [`/session/${bSession}`, `/session/${bSession}/edit`, `/session/${bSession}/customize`]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("B private session")).toHaveCount(0);
    }
  });

  test("I3: a forged session id in the edit form cannot change B's session", async ({ page }) => {
    await openOwnSession(page, "/edit");
    await forge(page, "id", bSession);
    await page.getByLabel("Name").fill("Hijacked");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();

    expect(await bSessionRow()).toMatchObject({ name: "B private session", user_id: bId });
  });

  test("I3: a forged session id in the customise form cannot change B's workout", async ({ page }) => {
    await openOwnSession(page, "/customize");
    await forge(page, "id", bSession);
    await page.getByRole("textbox", { name: "Instruction" }).first().fill("hijacked");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();

    const row = await bSessionRow();
    expect(JSON.stringify(row!.snapshot)).toContain("original");
    expect(JSON.stringify(row!.snapshot)).not.toContain("hijacked");
  });

  test("I4: a forged session id in the delete form cannot delete B's session", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await openOwnSession(page, "/edit");
    await forge(page, "id", bSession);
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();

    expect(await bSessionRow()).toBeDefined();
  });

  test("I5: ownership fields added to the add-session form are ignored", async ({ page }) => {
    await page.goto("/week/current/add?day=3&untimed=1");
    await page.getByRole("radio", { name: "Blank" }).check();
    await page.getByLabel("Name", { exact: true }).fill("Planted for B");
    await inject(page, "Add", "user_id", bId);
    await inject(page, "Add", "userId", bId);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForURL(/\/week\/[^/]+\?day=/);

    const rows = await readRows("scheduled_sessions", { name: "Planted for B" });
    expect(rows.filter((row) => row.user_id === aId)).toHaveLength(1);
    expect(rows.filter((row) => row.user_id === bId)).toHaveLength(0);
    expect(await readRows("scheduled_sessions", { user_id: bId })).toHaveLength(1);
  });

  test("I6: A cannot open B's routine or its editor", async ({ page }) => {
    for (const path of [`/library/${bRoutine}`, `/library/${bRoutine}/edit`]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    await page.goto("/library");
    await expect(page.getByText("B private routine")).toHaveCount(0);
  });

  test("I6: a forged routine id cannot overwrite or delete B's routine", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const mine = await createRoutine(page, "A own routine", "other", [["Step", "mine"]]);

    await page.goto(`${mine}/edit`);
    await forge(page, "id", bRoutine);
    await page.getByLabel("Name", { exact: true }).fill("Hijacked");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();
    expect(await bRoutineRow()).toMatchObject({ name: "B private routine", owner_user_id: bId });

    await page.goto(`${mine}/edit`);
    await forge(page, "id", bRoutine);
    await page.getByRole("button", { name: "Delete routine" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();
    expect(await bRoutineRow()).toBeDefined();
  });

  test("I7, I9: A cannot overwrite a GLOBAL routine or plant a routine for B", async ({ page }) => {
    const [lowerA] = await readRows("routines", { slug: "lower-a" });
    const mine = await createRoutine(page, "A second routine", "other", [["Step", "mine"]]);

    await page.goto(`${mine}/edit`);
    await forge(page, "id", lowerA!.id as string);
    await page.getByLabel("Name", { exact: true }).fill("Hijacked");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: ERROR_HEADING })).toBeVisible();
    expect((await readRows("routines", { slug: "lower-a" }))[0]).toMatchObject({ name: "Lower A" });

    await page.goto("/library/new");
    await page.getByLabel("Name", { exact: true }).fill("Planted routine");
    await page.getByRole("textbox", { name: "Workout item 1", exact: true }).fill("x");
    await inject(page, "Save", "owner_user_id", bId);
    await inject(page, "Save", "scope", "GLOBAL");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
    const planted = await readRows("routines", { name: "Planted routine", owner_user_id: aId });
    expect(planted).toHaveLength(1);
    expect(planted[0]).toMatchObject({ scope: "PERSONAL" });
    const bOwns = await readRows("routines", { owner_user_id: bId });
    expect(bOwns.map((row) => row.name)).toEqual(["B private routine"]);
  });

  test("I1, I8: A's week and Duplicate Week never include B's sessions", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/week/2026-W47");
    await expect(page.getByText("B private session")).toHaveCount(0);
    await expect(page.getByText("No sessions this week.")).toBeVisible();

    // Duplicate is only offered for A's own (empty) week; forge it anyway.
    await forge(page, "sourceWeekId", "2026-W47");
    await page.locator('select[name="destWeekId"]').selectOption("2026-W48");
    await page.locator("form").filter({ has: page.locator('select[name="destWeekId"]') }).evaluate(
      (form) => (form as HTMLFormElement).requestSubmit(),
    );
    await page.waitForURL(/\/week\/2026-W48/);
    await expect(page.getByText("B private session")).toHaveCount(0);
    expect(await readRows("scheduled_sessions", { user_id: aId })).toHaveLength(0);
    expect(await readRows("scheduled_sessions", { user_id: bId })).toHaveLength(1);
  });
});

/**
 * Admin server actions called directly. The request an admin's browser sends
 * is captured and replayed with someone else's cookies (or none).
 */
test.describe("admin actions replayed by others", () => {
  test("M2, M3: a member and an anonymous visitor cannot invite or revoke", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const created = `admin-made-${crypto.randomUUID()}@example.test`;
    const target = `replayed-${crypto.randomUUID()}@example.test`;
    const pending = `pending-${crypto.randomUUID()}@example.test`;
    const memberEmail = `revocable-${crypto.randomUUID()}@example.test`;

    await signInAsLocalAdmin(context, baseURL!);
    const member = await browser.newContext({ baseURL });
    const anonymous = await browser.newContext({ baseURL });
    try {
      const { userId: memberId } = await signInAsNewLocalUser(member, baseURL!);
      await makeLocalMember(memberId);
      await createAcceptedInvitation(memberEmail, memberId);

      await page.goto("/admin/invitations");

      // Capture a real invite request.
      await page.getByLabel("Email address").fill(created);
      const inviteRequest = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
      await page.getByRole("button", { name: "Invite" }).click();
      const invite = await inviteRequest;
      await expect(page.getByRole("status")).toHaveText("Invitation created.");
      const inviteBody = invite.postDataBuffer()!.toString("utf8").split(created).join(target);

      // Capture a real revoke request, for the admin's own pending invitation.
      await page.getByLabel("Email address").fill(pending);
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(page.getByRole("listitem").filter({ hasText: pending })).toBeVisible();
      const [pendingRow] = await readRows("invitations", { email: pending });
      const [memberRow] = await readRows("invitations", { email: memberEmail });
      page.once("dialog", (dialog) => dialog.accept());
      const revokeRequest = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
      await page.getByRole("listitem").filter({ hasText: pending }).getByRole("button", { name: "Revoke" }).click();
      const revoke = await revokeRequest;
      const revokeBody = revoke.postDataBuffer()!.toString("utf8")
        .split(pendingRow!.id as string).join(memberRow!.id as string);

      const replay = (ctx: typeof member, request: typeof invite, body: string) =>
        ctx.request.post(request.url(), {
          headers: {
            "next-action": request.headers()["next-action"]!,
            "content-type": request.headers()["content-type"]!,
            accept: "text/x-component",
          },
          data: Buffer.from(body, "utf8"),
          maxRedirects: 0,
        });

      for (const [who, ctx] of [["member", member], ["anonymous", anonymous]] as const) {
        const inviteResponse = await replay(ctx, invite, inviteBody);
        expect(inviteResponse.status(), `${who} invite`).not.toBe(200);
        expect(await readRows("invitations", { email: target }), `${who} invite`).toHaveLength(0);

        const revokeResponse = await replay(ctx, revoke, revokeBody);
        expect(revokeResponse.status(), `${who} revoke`).not.toBe(200);
        const [after] = await readRows("invitations", { email: memberEmail });
        expect(after!.revoked_at, `${who} revoke`).toBeNull();
      }

      // Sanity check: the same captured request does work for the admin.
      const own = await replay(context as typeof member, invite, inviteBody);
      expect(own.status()).toBe(200);
      expect(await readRows("invitations", { email: target })).toHaveLength(1);
    } finally {
      await deleteLocalInvitations([created, target, pending, memberEmail]);
      await member.close();
      await anonymous.close();
    }
  });
});
