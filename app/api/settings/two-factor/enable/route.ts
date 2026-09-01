import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { enableTwoFactor } from "@/lib/repositories/two-factor";
import { twoFactorEnableSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = twoFactorEnableSchema.parse(await request.json());
    return NextResponse.json(await enableTwoFactor(user.id, input.currentPassword, input.secret, input.code));
  } catch (error) {
    return errorResponse(error);
  }
}
