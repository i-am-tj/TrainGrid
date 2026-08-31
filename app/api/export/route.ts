import { NextResponse } from "next/server";
import { exportBackupPayload } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
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
