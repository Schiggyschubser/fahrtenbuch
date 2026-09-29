import { PrintPreview } from "@/components/PrintPreview";
import { getPrintColumnSettings, getVehicleSettings } from "@/lib/repositories/settings";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import { getTripsForMonth } from "@/lib/repositories/trips";
import { monthSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PrintPageProps = { searchParams: Promise<{ month?: string }> };

function validMonth(value?: string) {
  const result = monthSchema.safeParse(value);
  return result.success ? result.data : currentMonth();
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

export async function generateMetadata({ searchParams }: PrintPageProps): Promise<Metadata> {
  const month = validMonth((await searchParams).month);
  return { title: `Fahrtenbuch ${monthTitle(month)}` };
}

export default async function PrintPage({ searchParams }: PrintPageProps) {
  await requirePageUser();
  const month = validMonth((await searchParams).month);
  const data = await getTripsForMonth(month);
  const { visibleColumns } = await getPrintColumnSettings();
  const { licensePlate } = await getVehicleSettings();
  const createdAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <main className="print-shell">
      <PrintPreview data={data} visibleColumns={visibleColumns} title={monthTitle(month)} createdAt={createdAt} licensePlate={licensePlate} />
    </main>
  );
}
