import type { Direction } from "./db/schema";

export type UserDto = {
  id: number;
  username: string;
  usesDefaultCredentials: boolean;
};

export type RoutePairDto = {
  id: number;
  placeA: string;
  placeB: string;
  distanceKm: number;
  reimbursedKm: number;
  unreimbursedKm: number;
  durationMinutes: number;
};

export type RouteOptionDto = {
  value: string;
  routePairId: number;
  direction: Direction;
  origin: string;
  destination: string;
  distanceKm: number;
  reimbursedKm: number;
  unreimbursedKm: number;
  durationMinutes: number;
  label: string;
};

export type TripDto = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  routePairId: number | null;
  direction: Direction | null;
  origin: string;
  destination: string;
  routeLabel: string;
  distanceKm: number;
  reimbursedKm: number;
  unreimbursedKm: number;
  reimbursementRateCents: number;
  potentialReimbursementCents: number;
  odometerStart: number;
  odometerEnd: number;
  isChecked: boolean;
};

export type MonthDataDto = {
  trips: TripDto[];
  totalKm: number;
  totalReimbursedKm: number;
  totalUnreimbursedKm: number;
  totalPotentialReimbursementCents: number;
  suggestedOdometerStart: number | null;
};

export type TripDateRangeDto = {
  firstDate: string | null;
  lastDate: string | null;
};

export type TripCsvImportResultDto = {
  imported: number;
  skipped: number;
  backup: BackupDto | null;
  dateRange: TripDateRangeDto;
};

export type ReimbursementSettingsDto = {
  reimbursementRateCents: number;
};

export type TwoFactorStatusDto = {
  enabled: boolean;
  enabledAt: string | null;
  remainingBackupCodes: number;
};

export type TwoFactorSetupDto = {
  secret: string;
  qrCodeDataUrl: string;
};

export type DashboardSummaryDto = {
  totalKm: number;
  tripCount: number;
  activeDays: number;
  totalMinutes: number;
  averageKm: number;
};

export type DashboardDataDto = {
  selectedPeriod: string;
  availableYears: number[];
  summary: DashboardSummaryDto;
  trend: Array<{ key: string; label: string; totalKm: number; tripCount: number }>;
  comparison: null | {
    currentLabel: string;
    previousLabel: string;
    current: Pick<DashboardSummaryDto, "totalKm" | "tripCount">;
    previous: Pick<DashboardSummaryDto, "totalKm" | "tripCount">;
    kmDeltaPercent: number | null;
    tripDeltaPercent: number | null;
  };
  weekdays: Array<{ key: string; label: string; totalKm: number; tripCount: number }>;
  topRoutes: Array<{ routeLabel: string; totalKm: number; tripCount: number }>;
  recentTrips: TripDto[];
  dataRange: null | { firstDate: string; lastDate: string };
};

export type BackupKind = "automatic" | "manual" | "pre-restore" | "safety";

export type BackupDto = {
  id: string;
  kind: BackupKind;
  createdAt: string;
  sizeBytes: number;
};
