import { handleMobileApi } from "@/lib/mobile-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  return handleMobileApi(request, (await context.params).path);
}
export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
