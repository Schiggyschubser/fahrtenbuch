import { describe, expect, it } from "vitest";
import { searchRouteOptions, toRouteOptions } from "@/lib/route-options";
import type { RoutePairDto } from "@/lib/types";

const pairs: RoutePairDto[] = [
  [1, "COII", "Zentrale"], [2, "AG", "COII"], [3, "COII", "Büro"], [4, "COII", "Ärztehaus"],
].map(([id, placeA, placeB]) => ({
  id: Number(id), placeA: String(placeA), placeB: String(placeB), placeAFullName: "", placeBFullName: "",
  distanceKm: 20, reimbursedKm: 15, unreimbursedKm: 5, durationMinutes: 30,
}));
const labels = (query: string) => toRouteOptions(pairs, query).map((option) => option.label);
const allLabels = ["AG → COII", "Ärztehaus → COII", "Büro → COII", "COII → AG", "COII → Ärztehaus", "COII → Büro", "COII → Zentrale", "Zentrale → COII"];

describe("Reisewegsuche", () => {
  it("ordnet zuerst Treffer am Anfang und danach weitere Treffer jeweils alphabetisch", () => {
    expect(labels("Coii")).toEqual([
      "COII → AG", "COII → Ärztehaus", "COII → Büro", "COII → Zentrale",
      "AG → COII", "Ärztehaus → COII", "Büro → COII", "Zentrale → COII",
    ]);
    expect(labels(" cOiI ")).toEqual(labels("Coii"));
  });

  it("listet ohne Suche alle Richtungen alphabetisch auf", () => {
    expect(labels("")).toEqual(allLabels);
    expect(labels("   ")).toEqual(allLabels);
  });

  it("filtert Treffer im Ziel und innerhalb eines Ortsnamens ohne andere Einträge", () => {
    expect(labels("büro")).toEqual(["Büro → COII", "COII → Büro"]);
    expect(labels("oii")).toEqual(allLabels);
    expect(labels("COII → Büro")).toEqual(["COII → Büro"]);
    expect(labels("unbekannt")).toEqual([]);
  });

  it("sortiert auch unsortierte Auswahldaten und verändert die Eingabe nicht", () => {
    const options = toRouteOptions(pairs).toReversed();
    const originalValues = options.map((option) => option.value);
    expect(searchRouteOptions(options).map((option) => option.label)).toEqual(allLabels);
    expect(options.map((option) => option.value)).toEqual(originalValues);
    expect(searchRouteOptions([], "Coii")).toEqual([]);
  });

  it("erhält Streckenkennung, Fahrtrichtung und Kilometerwerte", () => {
    expect(toRouteOptions(pairs, "COII → AG")).toEqual([{
      value: "2:B_TO_A", routePairId: 2, direction: "B_TO_A", origin: "COII", destination: "AG",
      label: "COII → AG", distanceKm: 20, reimbursedKm: 15, unreimbursedKm: 5, durationMinutes: 30,
    }]);
  });
});
