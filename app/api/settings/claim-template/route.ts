import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getClaimTemplate, updateClaimTemplate } from "@/lib/repositories/claim-template";

export async function GET() {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    return NextResponse.json(await getClaimTemplate(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    const body = await request.text();
    if (body.length > 400_000) return NextResponse.json({ error: "Die Antragsvorlage ist zu groß." }, { status: 413 });
    return NextResponse.json(await updateClaimTemplate(JSON.parse(body)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
