import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteTrip, updateTrip } from "@/lib/repositories/trips";
import { updateTripSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Ungültige ID.");
  return id;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const id = parseId((await context.params).id);
    const input = updateTripSchema.parse(await request.json());
    const trip = await updateTrip(id, input);
    if (!trip) return NextResponse.json({ error: "Fahrt nicht gefunden." }, { status: 404 });
    return NextResponse.json({ trip });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const deleted = await deleteTrip(parseId((await context.params).id));
    if (!deleted) return NextResponse.json({ error: "Fahrt nicht gefunden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
