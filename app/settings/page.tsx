import { AppHeader } from "@/components/AppHeader";
import { DefaultCredentialsNotice } from "@/components/DefaultCredentialsNotice";
import { SettingsClient, type SettingsTab } from "@/components/SettingsClient";
import { requirePageUser } from "@/lib/auth";
import { getActiveRoutePairs } from "@/lib/repositories/routes";
import { getReimbursementSettings, getVehicleSettings } from "@/lib/repositories/settings";
import { getTwoFactorStatus } from "@/lib/repositories/two-factor";
import { getTripDateRange } from "@/lib/repositories/trips";
import { listBackups } from "@/lib/backups";
import { getRemarkSettings } from "@/lib/repositories/remarks";
import { getClaimTemplate } from "@/lib/repositories/claim-template";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, params] = await Promise.all([requirePageUser(), searchParams]);
  const initialTab: SettingsTab = params.tab === "claim" || params.tab === "appearance" || params.tab === "remarks" || params.tab === "backups" || params.tab === "reimbursement" || params.tab === "transfer" || params.tab === "credentials" ? params.tab : "routes";
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
      <main className="app-frame app-content page-enter py-5 lg:py-6">
        {user.usesDefaultCredentials ? <DefaultCredentialsNotice /> : null}
        <div className="section-enter mb-5">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[var(--text-secondary)]">Konfiguration</p>
          <h1 className="text-[29px] font-extrabold tracking-[-.04em] sm:text-[32px] lg:text-[34px]">Einstellungen</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Passe Darstellung, Reisewege, Abrechnung und deinen persönlichen Zugang an.</p>
        </div>
        <SettingsClient
          initialClaimTemplate={await getClaimTemplate()}
          initialVehicleSettings={await getVehicleSettings()}
          initialRemarkSettings={getRemarkSettings()}
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
