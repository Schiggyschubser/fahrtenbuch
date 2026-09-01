export function unreimbursedKm(distanceKm: number, reimbursedKm: number) {
  return Math.max(distanceKm - reimbursedKm, 0);
}
