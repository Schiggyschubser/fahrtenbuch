import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getTwoFactorStatus } from "@/lib/repositories/two-factor";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    return NextResponse.json(getTwoFactorStatus(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
