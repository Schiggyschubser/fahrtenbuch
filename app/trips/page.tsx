import { AppHeader } from "@/components/AppHeader";
import { DashboardClient } from "@/components/DashboardClient";
import { DefaultCredentialsNotice } from "@/components/DefaultCredentialsNotice";
import { requirePageUser } from "@/lib/auth";
import { currentMonth, validMonthOrCurrent } from "@/lib/dates";
import { getActiveRoutePairs, toRouteOptions } from "@/lib/repositories/routes";
import { getTripsForMonth } from "@/lib/repositories/trips";

export const dynamic = "force-dynamic";

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [user, params] = await Promise.all([requirePageUser(), searchParams]);
  const todayMonth = currentMonth();
  const month = validMonthOrCurrent(params.month);
  const [pairs, monthData] = await Promise.all([
    getActiveRoutePairs(),
    getTripsForMonth(month),
  ]);

  return (
    <>
      <AppHeader />
      <main className="page-enter mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {user.usesDefaultCredentials ? <DefaultCredentialsNotice /> : null}
        <DashboardClient initialMonth={month} todayMonth={todayMonth} initialData={monthData} routeOptions={toRouteOptions(pairs)} />
      </main>
    </>
  );
}
