import { AppHeader } from "@/components/AppHeader";
import { DashboardOverviewClient } from "@/components/DashboardOverviewClient";
import { DashboardQuickAdd } from "@/components/DashboardQuickAdd";
import { DefaultCredentialsNotice } from "@/components/DefaultCredentialsNotice";
import { requirePageUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/repositories/dashboard";
import { getActiveRoutePairs, toRouteOptions } from "@/lib/repositories/routes";
import { getSuggestedOdometer } from "@/lib/repositories/trips";
import { currentDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; addTrip?: string }> }) {
  const [user, params] = await Promise.all([requirePageUser(), searchParams]);
  const today = currentDate();
  const [data, pairs, suggestedOdometerStart] = await Promise.all([getDashboardData(params.year), getActiveRoutePairs(), getSuggestedOdometer(today)]);
  return (
    <>
      <AppHeader />
      <main className="page-enter mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {user.usesDefaultCredentials ? <DefaultCredentialsNotice /> : null}
        <DashboardOverviewClient initialData={data} />
        {params.addTrip === "1" ? <DashboardQuickAdd routeOptions={toRouteOptions(pairs)} suggestedOdometerStart={suggestedOdometerStart} defaultDate={today} /> : null}
      </main>
    </>
  );
}
