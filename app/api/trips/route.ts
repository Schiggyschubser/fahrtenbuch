import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createTrip, getTripsForMonth } from "@/lib/repositories/trips";
import { createTripSchema, monthSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const month = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    return NextResponse.json(await getTripsForMonth(month));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const input = createTripSchema.parse(await request.json());
    return NextResponse.json({ trip: await createTrip(input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
