import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getSuggestedOdometer } from "@/lib/repositories/trips";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const startTime = params.get("startTime") || undefined;
  if (!datePattern.test(date) || (startTime && !timePattern.test(startTime))) {
    return NextResponse.json({ error: "Ungültiges Datum oder ungültige Uhrzeit." }, { status: 400 });
  }
  return NextResponse.json({ odometerStart: await getSuggestedOdometer(date, startTime) });
}
