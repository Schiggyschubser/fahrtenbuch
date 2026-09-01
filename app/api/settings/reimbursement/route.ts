import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getReimbursementSettings, updateReimbursementSettings } from "@/lib/repositories/settings";
import { reimbursementSettingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    return NextResponse.json(await getReimbursementSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = reimbursementSettingsSchema.parse(await request.json());
    return NextResponse.json(await updateReimbursementSettings(input.reimbursementRateCents));
  } catch (error) {
    return errorResponse(error);
  }
}
