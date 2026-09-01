import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { archiveRoutePair, updateRoutePair } from "@/lib/repositories/routes";
import { routePairSchema } from "@/lib/validation";

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
    const input = routePairSchema.parse(await request.json());
    const route = await updateRoutePair(id, input);
    if (!route) return NextResponse.json({ error: "Reiseweg nicht gefunden." }, { status: 404 });
    return NextResponse.json({ route });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    if (!user) return unauthorizedResponse();
    const route = await archiveRoutePair(parseId((await context.params).id));
    if (!route) return NextResponse.json({ error: "Reiseweg nicht gefunden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
