"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RouteOptionDto } from "@/lib/types";
import { TripModal } from "./TripModal";

export function DashboardQuickAdd({ routeOptions, suggestedOdometerStart, defaultDate }: { routeOptions: RouteOptionDto[]; suggestedOdometerStart: number | null; defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    window.history.replaceState(window.history.state, "", "/");
    setOpen(false);
  }

  if (!open) return null;
  return <TripModal month={defaultDate.slice(0, 7)} defaultDate={defaultDate} suggestedOdometerStart={suggestedOdometerStart} routeOptions={routeOptions} onClose={close} onSaved={() => { close(); router.refresh(); }} />;
}
