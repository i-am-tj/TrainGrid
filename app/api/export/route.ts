import { NextResponse } from "next/server";
import { exportBackupPayload } from "@/lib/actions";
import { getViewer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  // Checked here as well as in the proxy and in the data function.
  const viewer = await getViewer();
  if (viewer.status !== "member") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const payload = await exportBackupPayload();
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="traingrid-backup.json"`,
      "Cache-Control": "no-store",
    },
  });
}
