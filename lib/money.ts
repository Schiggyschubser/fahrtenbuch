export function potentialReimbursementCents(reimbursedKm: number, rateCents: number) {
  return reimbursedKm * rateCents;
}

export function formatEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
