import { describe, it, expect } from "vitest";
import { formatNumber, formatCurrency, renderBanner, renderTable } from "../src/utils/formatting.js";

describe("Formatting Utilities", () => {
  describe("formatNumber", () => {
    it("formats numbers with locale separators", () => {
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(1234)).toMatch(/1[,\s.]234/);
      expect(formatNumber(1000000)).toMatch(/(1[,\s.]000[,\s.]000|10[,\s.]00[,\s.]000)/);
    });
  });

  describe("formatCurrency", () => {
    it("formats USD currency with 3 decimal places", () => {
      const formattedZero = formatCurrency(0);
      expect(formattedZero).toBe("$0.000");

      const formattedAmount = formatCurrency(12.3456);
      expect(formattedAmount).toBe("$12.346");

      const formattedSubcent = formatCurrency(0.0019);
      expect(formattedSubcent).toBe("$0.002");
    });
  });

  describe("renderBanner", () => {
    it("renders ASCII banner with product title", () => {
      const banner = renderBanner();
      expect(banner).toContain("Peripheral Evaluation & Execution Proxy");
      expect(banner).toContain("The Open-Source Token Shield for Autonomous Agents");
    });
  });

  describe("renderTable", () => {
    it("renders table with headers and data rows", () => {
      const headers = ["Metric", "Value"];
      const rows = [
        ["Screenshots", "15"],
        ["Savings", "$0.120"],
      ];

      const table = renderTable(headers, rows);
      expect(table).toContain("Metric");
      expect(table).toContain("Value");
      expect(table).toContain("Screenshots");
      expect(table).toContain("15");
      expect(table).toContain("Savings");
      expect(table).toContain("$0.120");
      expect(table).toContain("─");
      expect(table).toContain("┼");
    });

    it("renders table with an optional title", () => {
      const table = renderTable(["A"], [["B"]], "Test Title");
      expect(table).toContain("Test Title");
    });

    it("handles empty rows or missing cells gracefully", () => {
      const table = renderTable(["Col1", "Col2"], [["OnlyCol1"]]);
      expect(table).toContain("Col1");
      expect(table).toContain("Col2");
      expect(table).toContain("OnlyCol1");
    });
  });
});
