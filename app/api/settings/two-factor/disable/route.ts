import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { disableTwoFactor } from "@/lib/repositories/two-factor";
import { twoFactorProtectedActionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = twoFactorProtectedActionSchema.parse(await request.json());
    return NextResponse.json(await disableTwoFactor(user.id, input.currentPassword, input.code));
  } catch (error) {
    return errorResponse(error);
  }
}
