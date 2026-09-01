import { NextResponse } from "next/server";
import { firstZodMessage } from "./validation";
import { ZodError } from "zod";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
}

export function errorResponse(error: unknown, fallback = "Die Anfrage konnte nicht verarbeitet werden.") {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: firstZodMessage(error) }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : fallback;
  const conflict = message.includes("UNIQUE") || message.includes("bereits");
  console.error(error);
  return NextResponse.json({ error: conflict ? "Dieser Eintrag ist bereits vorhanden." : message || fallback }, { status: conflict ? 409 : 400 });
}
