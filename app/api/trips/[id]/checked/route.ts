import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { setTripChecked } from "@/lib/repositories/trips";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id < 1) throw new Error("Ungültige ID.");
    const { isChecked } = z.object({ isChecked: z.boolean() }).parse(await request.json());
    const trip = await setTripChecked(id, isChecked);
    if (!trip) return NextResponse.json({ error: "Fahrt nicht gefunden." }, { status: 404 });
    return NextResponse.json({ trip });
  } catch (error) {
    return errorResponse(error);
  }
}
