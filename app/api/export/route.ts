import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { exportUserData } from "@/lib/data/export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Downloads the signed-in member's own data (D-06): their personal routines
 * and their scheduled sessions. Never GLOBAL routines, other members, or
 * invitation, auth or infrastructure data.
 */
export async function GET() {
  // Checked here as well as in the proxy; RLS restricts the queries again.
  const viewer = await getViewer();
  if (viewer.status !== "member") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = await createSupabaseServerClient();
  const payload = await exportUserData(db, viewer.userId);
  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="traingrid-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}
