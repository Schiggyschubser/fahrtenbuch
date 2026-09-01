import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createBackup, listBackups } from "@/lib/backups";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    return NextResponse.json({ backups: await listBackups() });
  } catch (error) {
    return errorResponse(error, "Die Sicherungen konnten nicht geladen werden.");
  }
}

export async function POST() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const backup = await createBackup("manual");
    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Die Sicherung konnte nicht erstellt werden.");
  }
}
