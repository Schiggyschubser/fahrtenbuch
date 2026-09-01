import { AppHeader } from "@/components/AppHeader";
import { DefaultCredentialsNotice } from "@/components/DefaultCredentialsNotice";
import { SettingsClient, type SettingsTab } from "@/components/SettingsClient";
import { requirePageUser } from "@/lib/auth";
import { getActiveRoutePairs } from "@/lib/repositories/routes";
import { getReimbursementSettings } from "@/lib/repositories/settings";
import { getTwoFactorStatus } from "@/lib/repositories/two-factor";
import { getTripDateRange } from "@/lib/repositories/trips";
import { listBackups } from "@/lib/backups";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, params] = await Promise.all([requirePageUser(), searchParams]);
  const initialTab: SettingsTab = params.tab === "appearance" || params.tab === "backups" || params.tab === "reimbursement" || params.tab === "transfer" || params.tab === "credentials" ? params.tab : "routes";
  const [routes, backups, reimbursementSettings, twoFactorStatus, tripDateRange] = await Promise.all([
    getActiveRoutePairs(),
    listBackups(),
    getReimbursementSettings(),
    getTwoFactorStatus(user.id),
    getTripDateRange(),
  ]);
  return (
    <>
      <AppHeader />
      <main className="page-enter mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {user.usesDefaultCredentials ? <DefaultCredentialsNotice /> : null}
        <div className="section-enter mb-5 lg:mb-7">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[var(--text-secondary)]">Konfiguration</p>
          <h1 className="text-[29px] font-extrabold tracking-[-.04em] sm:text-[32px] lg:text-[34px]">Einstellungen</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Passe Darstellung, Reisewege, Abrechnung und deinen persönlichen Zugang an.</p>
        </div>
        <SettingsClient
          initialRoutes={routes}
          initialBackups={backups}
          initialReimbursementSettings={reimbursementSettings}
          initialTwoFactorStatus={twoFactorStatus}
          initialTripDateRange={tripDateRange}
          initialTab={initialTab}
          username={user.username}
        />
      </main>
    </>
  );
}
