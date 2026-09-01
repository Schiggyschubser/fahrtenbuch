import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createRoutePair, getActiveRoutePairs } from "@/lib/repositories/routes";
import { routePairSchema } from "@/lib/validation";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();
  return NextResponse.json({ routes: await getActiveRoutePairs() });
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = routePairSchema.parse(await request.json());
    const route = await createRoutePair(input);
    return NextResponse.json({ route }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
