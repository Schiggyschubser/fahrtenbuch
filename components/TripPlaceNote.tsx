export function TripPlaceNote({ originFullName, destinationFullName }: {
  originFullName: string;
  destinationFullName: string;
}) {
  if (!originFullName && !destinationFullName) return null;
  const text = originFullName && destinationFullName
    ? `${originFullName} → ${destinationFullName}`
    : originFullName ? `Start: ${originFullName}` : `Ziel: ${destinationFullName}`;
  return <span data-testid="trip-place-note" className="mt-1 block whitespace-normal break-words text-[0.85em] font-normal leading-snug text-[var(--text-secondary)]">{text}</span>;
}
