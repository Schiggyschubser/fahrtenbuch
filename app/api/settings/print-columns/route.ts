import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getPrintColumnSettings, updatePrintColumnSettings } from "@/lib/repositories/settings";
import { tripColumnsSettingsSchema } from "@/lib/trip-columns";

export async function GET() {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    return NextResponse.json(await getPrintColumnSettings(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    const input = tripColumnsSettingsSchema.parse(await request.json());
    return NextResponse.json(await updatePrintColumnSettings(input.visibleColumns));
  } catch (error) { return errorResponse(error); }
}
