import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createTwoFactorSetup } from "@/lib/repositories/two-factor";
import { twoFactorPasswordSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = twoFactorPasswordSchema.parse(await request.json());
    return NextResponse.json(await createTwoFactorSetup(user.id, input.currentPassword));
  } catch (error) {
    return errorResponse(error);
  }
}
