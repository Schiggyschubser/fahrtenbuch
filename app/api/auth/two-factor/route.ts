import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { completeTwoFactorLogin } from "@/lib/repositories/two-factor";
import { twoFactorChallengeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = twoFactorChallengeSchema.parse(await request.json());
    const result = await completeTwoFactorLogin(input.challengeToken, input.code);
    await createSession(result.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
