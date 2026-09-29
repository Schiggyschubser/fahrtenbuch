import { describe, expect, it } from "vitest";
import { normalizeTimeInput } from "@/lib/time-input";

describe("compact time input", () => {
  it.each([
    ["0815", "08:15"], ["0000", "00:00"], ["2359", "23:59"],
    ["08:15", "08:15"], ["", ""], ["0", "0"], ["081", "081"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeTimeInput(input)).toBe(expected);
  });

  it.each(["2400", "2360", "9999", "08x15", "08.15", "08150"])(
    "preserves invalid input %j so form validation rejects it", (input) => {
      expect(normalizeTimeInput(input)).toBe(input);
    },
  );
});
