import type { RouteOptionDto, RoutePairDto } from "./types";

/** Shared by the route picker and API so both return the same search order. */
export function searchRouteOptions(options: readonly RouteOptionDto[], search = ""): RouteOptionDto[] {
  const query = search.trim().toLocaleLowerCase("de-DE");
  const normalizeLabel = (option: RouteOptionDto) => option.label.toLocaleLowerCase("de-DE");
  return options
    .filter((option) => !query || normalizeLabel(option).includes(query))
    .toSorted((a, b) => {
      if (query) {
        const prefixOrder = Number(normalizeLabel(b).startsWith(query)) - Number(normalizeLabel(a).startsWith(query));
        if (prefixOrder) return prefixOrder;
      }
      return a.label.localeCompare(b.label, "de", { sensitivity: "base" });
    });
}

export function toRouteOptions(pairs: readonly RoutePairDto[], search = ""): RouteOptionDto[] {
  return searchRouteOptions(pairs.flatMap((pair) => (["A_TO_B", "B_TO_A"] as const).map((direction) => {
    const origin = direction === "A_TO_B" ? pair.placeA : pair.placeB;
    const destination = direction === "A_TO_B" ? pair.placeB : pair.placeA;
    return {
      value: `${pair.id}:${direction}`,
      routePairId: pair.id,
      direction,
      origin,
      destination,
      distanceKm: pair.distanceKm,
      reimbursedKm: pair.reimbursedKm,
      unreimbursedKm: pair.unreimbursedKm,
      durationMinutes: pair.durationMinutes,
      label: `${origin} → ${destination}`,
    };
  })), search);
}
