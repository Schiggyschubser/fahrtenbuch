import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createRoutePair, getActiveRoutePairs, toRouteOptions } from "@/lib/repositories/routes";
import { routePairSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();
  const routes = await getActiveRoutePairs();
  return NextResponse.json({ routes, routeOptions: toRouteOptions(routes, new URL(request.url).searchParams.get("q") ?? "") });
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
