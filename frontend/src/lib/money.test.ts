import { describe, expect, it } from "vitest";
import { formatMoney, minorUnitsPer, parseMoney, splitEqually, toDecimalString } from "./money";

describe("money helpers", () => {
    it("uses 100 minor units for USD and 1 for JPY", () => {
        expect(minorUnitsPer("USD")).toBe(100);
        expect(minorUnitsPer("JPY")).toBe(1);
    });

    it("parses decimal input strings into minor units", () => {
        expect(parseMoney("12.34", "USD")).toBe(1234);
        expect(parseMoney("12.3", "USD")).toBe(1230);
        expect(parseMoney("12.345", "USD")).toBe(null);
    });

    it("formats signed and unsigned money correctly", () => {
        expect(formatMoney(1234, "USD")).toBe("$12.34");
        expect(formatMoney(-1234, "USD", { signed: true })).toBe("-$12.34");
    });

    it("round-trips to decimal strings and splits equally", () => {
        expect(toDecimalString(1234, "USD")).toBe("12.34");
        expect(splitEqually(100, 3)).toEqual([34, 33, 33]);
    });
});
