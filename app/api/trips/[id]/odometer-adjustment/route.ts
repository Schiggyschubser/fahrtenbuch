import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { previewTripOdometerAdjustment } from "@/lib/repositories/trips";
import { updateTripRequestSchema } from "@/lib/validation";
import { z } from "zod";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse((await context.params).id);
    const { expectedUpdatedAt, ...input } = updateTripRequestSchema.parse(await request.json());
    const preview = previewTripOdometerAdjustment(id, input, expectedUpdatedAt);
    if (!preview) return NextResponse.json({ error: "Fahrt nicht gefunden." }, { status: 404 });
    return NextResponse.json({ preview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
