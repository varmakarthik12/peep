import { describe, it, expect, beforeEach } from "vitest";
import { tokenShield, TokenShield } from "../src/core/token-shield.js";

describe("TokenShield", () => {
  beforeEach(() => {
    tokenShield.reset();
  });

  describe("Initial State & Defaults", () => {
    it("reports correct baseline metrics when no actions have occurred", () => {
      const metrics = tokenShield.getMetrics();
      expect(metrics.totalActions).toBe(0);
      expect(metrics.screenshotsShielded).toBe(0);
      expect(metrics.logLinesShielded).toBe(0);
      expect(metrics.macroStepsShielded).toBe(0);
      expect(metrics.cloudTokensSaved).toBe(0);
      expect(metrics.cloudTokensUsed).toBe(0);
      expect(metrics.estimatedCostSavedUsd).toBe(0);
      expect(metrics.netTokenSavingsPercentage).toBe(100);
    });
  });

  describe("Screenshot Shielding", () => {
    it("accurately records shielded screenshots with default payload tokens", () => {
      const saved = tokenShield.recordShieldedScreenshot();
      expect(saved).toBe(TokenShield.TOKENS_PER_IMAGE);

      const metrics = tokenShield.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.screenshotsShielded).toBe(1);
      expect(metrics.cloudTokensSaved).toBe(1600);
      expect(metrics.cloudTokensUsed).toBe(60);
      // (1600 - 60) / 1600 = 96.25% -> 96.3%
      expect(metrics.netTokenSavingsPercentage).toBe(96.3);
    });

    it("accurately records shielded screenshots with custom payload tokens", () => {
      tokenShield.recordShieldedScreenshot(40);
      const metrics = tokenShield.getMetrics();
      expect(metrics.cloudTokensUsed).toBe(40);
      expect(metrics.netTokenSavingsPercentage).toBe(97.5);
    });
  });

  describe("Log Lines Shielding", () => {
    it("accurately records shielded log lines", () => {
      const saved = tokenShield.recordShieldedLogs(1000, 50);
      expect(saved).toBe(1000 * TokenShield.TOKENS_PER_LOG_LINE);

      const metrics = tokenShield.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.logLinesShielded).toBe(1000);
      expect(metrics.cloudTokensSaved).toBe(14000);
      expect(metrics.cloudTokensUsed).toBe(50);
      expect(metrics.netTokenSavingsPercentage).toBeGreaterThan(99);
    });

    it("handles zero log lines correctly", () => {
      const saved = tokenShield.recordShieldedLogs(0, 10);
      expect(saved).toBe(0);

      const metrics = tokenShield.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.logLinesShielded).toBe(0);
      expect(metrics.cloudTokensSaved).toBe(0);
      expect(metrics.cloudTokensUsed).toBe(10);
    });
  });

  describe("Autonomous Macro Shielding", () => {
    it("accurately records shielded macro micro-loop steps", () => {
      // 5 steps: each step saves TOKENS_PER_IMAGE (1600) + 300 = 1900 tokens
      const saved = tokenShield.recordShieldedMacro(5, 100);
      expect(saved).toBe(5 * (TokenShield.TOKENS_PER_IMAGE + 300)); // 9,500 tokens

      const metrics = tokenShield.getMetrics();
      expect(metrics.totalActions).toBe(5);
      expect(metrics.macroStepsShielded).toBe(5);
      expect(metrics.cloudTokensSaved).toBe(9500);
      expect(metrics.cloudTokensUsed).toBe(100);
      // (9500 - 100) / 9500 = 98.9%
      expect(metrics.netTokenSavingsPercentage).toBe(98.9);
    });
  });

  describe("Cost Savings & Math Edge Cases", () => {
    it("calculates estimated cost savings in USD accurately", () => {
      // 10 screenshots = 16,000 tokens saved
      for (let i = 0; i < 10; i++) {
        tokenShield.recordShieldedScreenshot(60);
      }
      const metrics = tokenShield.getMetrics();
      expect(metrics.cloudTokensSaved).toBe(16000);
      // 16,000 tokens @ $5.00 / 1,000,000 = $0.08
      expect(metrics.estimatedCostSavedUsd).toBe(0.08);
    });

    it("clamps netTokenSavingsPercentage to 0 when tokens used exceed tokens saved", () => {
      // If 1 screenshot saved 1600 tokens but payload somehow used 2000 tokens
      tokenShield.recordShieldedScreenshot(2000);
      const metrics = tokenShield.getMetrics();
      expect(metrics.netTokenSavingsPercentage).toBe(0);
    });

    it("resets all counters back to zero", () => {
      tokenShield.recordShieldedScreenshot(50);
      tokenShield.recordShieldedLogs(500, 30);
      tokenShield.recordShieldedMacro(3, 80);

      expect(tokenShield.getMetrics().totalActions).toBe(5);

      tokenShield.reset();

      const resetMetrics = tokenShield.getMetrics();
      expect(resetMetrics.totalActions).toBe(0);
      expect(resetMetrics.screenshotsShielded).toBe(0);
      expect(resetMetrics.logLinesShielded).toBe(0);
      expect(resetMetrics.macroStepsShielded).toBe(0);
      expect(resetMetrics.cloudTokensSaved).toBe(0);
      expect(resetMetrics.cloudTokensUsed).toBe(0);
      expect(resetMetrics.estimatedCostSavedUsd).toBe(0);
      expect(resetMetrics.netTokenSavingsPercentage).toBe(100);
    });
  });
});
