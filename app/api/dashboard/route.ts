import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/repositories/dashboard";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const year = new URL(request.url).searchParams.get("year") ?? undefined;
    return NextResponse.json(await getDashboardData(year));
  } catch (error) {
    return errorResponse(error);
  }
}
