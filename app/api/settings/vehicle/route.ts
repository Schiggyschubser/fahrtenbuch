import { NextResponse } from "next/server";
import { errorResponse, unauthorizedResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getVehicleSettings, updateVehicleSettings } from "@/lib/repositories/settings";
import { vehicleSettingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    return NextResponse.json(await getVehicleSettings());
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    if (!await requireApiUser()) return unauthorizedResponse();
    const input = vehicleSettingsSchema.parse(await request.json());
    return NextResponse.json(await updateVehicleSettings(input.licensePlate));
  } catch (error) { return errorResponse(error); }
}
