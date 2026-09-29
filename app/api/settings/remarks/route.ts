import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { getRemarkSettings, updateRemarkSettings } from "@/lib/repositories/remarks";

export async function GET() {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    return NextResponse.json(getRemarkSettings());
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    return NextResponse.json(updateRemarkSettings(await request.json()));
  } catch (error) { return errorResponse(error); }
}
