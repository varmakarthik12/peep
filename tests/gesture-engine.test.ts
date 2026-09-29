import { describe, it, expect } from "vitest";
import { GestureEngine, ANDROID_KEYCODES } from "../src/core/gesture-engine.js";

describe("GestureEngine", () => {
  describe("Swipe Calculations", () => {
    const width = 1080;
    const height = 2400;

    it("calculates swipe up (swiping finger up to scroll down)", () => {
      const swipe = GestureEngine.calculateSwipe(width, height, "up", "medium");
      expect(swipe.startX).toBe(540);
      expect(swipe.endX).toBe(540);
      // Up swipe: startY > endY
      expect(swipe.startY).toBeGreaterThan(swipe.endY);
      // Factor is 0.3, so delta is height * 0.3 = 720
      expect(swipe.startY - swipe.endY).toBe(720);
      expect(swipe.durationMs).toBe(350);
    });

    it("calculates swipe down (swiping finger down to scroll up)", () => {
      const swipe = GestureEngine.calculateSwipe(width, height, "down", "medium");
      expect(swipe.startX).toBe(540);
      expect(swipe.endX).toBe(540);
      // Down swipe: startY < endY
      expect(swipe.startY).toBeLessThan(swipe.endY);
      expect(swipe.endY - swipe.startY).toBe(720);
    });

    it("calculates swipe left (swiping finger left)", () => {
      const swipe = GestureEngine.calculateSwipe(width, height, "left", "medium");
      expect(swipe.startY).toBe(1200);
      expect(swipe.endY).toBe(1200);
      // Left swipe: startX > endX
      expect(swipe.startX).toBeGreaterThan(swipe.endX);
      // Factor 0.3 * 1080 = 324
      expect(swipe.startX - swipe.endX).toBe(324);
    });

    it("calculates swipe right (swiping finger right)", () => {
      const swipe = GestureEngine.calculateSwipe(width, height, "right", "medium");
      expect(swipe.startY).toBe(1200);
      expect(swipe.endY).toBe(1200);
      // Right swipe: startX < endX
      expect(swipe.startX).toBeLessThan(swipe.endX);
      expect(swipe.endX - swipe.startX).toBe(324);
    });

    it("supports different swipe distances: short, medium, and long", () => {
      const shortSwipe = GestureEngine.calculateSwipe(width, height, "up", "short");
      const medSwipe = GestureEngine.calculateSwipe(width, height, "up", "medium");
      const longSwipe = GestureEngine.calculateSwipe(width, height, "up", "long");

      const shortDelta = shortSwipe.startY - shortSwipe.endY;
      const medDelta = medSwipe.startY - medSwipe.endY;
      const longDelta = longSwipe.startY - longSwipe.endY;

      expect(shortDelta).toBeLessThan(medDelta);
      expect(medDelta).toBeLessThan(longDelta);
      // short: 0.15 * 2400 = 360, long: 0.5 * 2400 = 1200
      expect(shortDelta).toBe(360);
      expect(longDelta).toBe(1200);
    });

    it("clamps swipe coordinates to display dimensions", () => {
      // Very small dimension where swipe could otherwise push coordinates outside
      const swipe = GestureEngine.calculateSwipe(10, 10, "up", "long");
      expect(swipe.startX).toBeGreaterThanOrEqual(0);
      expect(swipe.startX).toBeLessThanOrEqual(10);
      expect(swipe.startY).toBeGreaterThanOrEqual(0);
      expect(swipe.startY).toBeLessThanOrEqual(10);
      expect(swipe.endX).toBeGreaterThanOrEqual(0);
      expect(swipe.endX).toBeLessThanOrEqual(10);
      expect(swipe.endY).toBeGreaterThanOrEqual(0);
      expect(swipe.endY).toBeLessThanOrEqual(10);
    });

    it("respects custom duration parameter", () => {
      const swipe = GestureEngine.calculateSwipe(width, height, "up", "medium", 700);
      expect(swipe.durationMs).toBe(700);
    });
  });

  describe("Text Sanitization for ADB", () => {
    it("handles empty string without error", () => {
      expect(GestureEngine.sanitizeAdbText("")).toBe("");
    });

    it("replaces spaces with %s", () => {
      expect(GestureEngine.sanitizeAdbText("hello world")).toBe("hello%sworld");
      expect(GestureEngine.sanitizeAdbText("  a  b  ")).toBe("%s%sa%s%sb%s%s");
    });

    it("escapes special shell metacharacters", () => {
      const input = '\\ " \' & < > | ; $';
      const sanitized = GestureEngine.sanitizeAdbText(input);

      expect(sanitized).toContain("\\\\");
      expect(sanitized).toContain('\\"');
      expect(sanitized).toContain("\\'");
      expect(sanitized).toContain("\\&");
      expect(sanitized).toContain("\\<");
      expect(sanitized).toContain("\\>");
      expect(sanitized).toContain("\\|");
      expect(sanitized).toContain("\\;");
      expect(sanitized).toContain("\\$");
    });

    it("escapes command injection attempts properly", () => {
      const dangerous = 'hello; rm -rf / && echo "pwned" | cat $HOME > /dev/null';
      const sanitized = GestureEngine.sanitizeAdbText(dangerous);

      expect(sanitized).not.toContain(" ");
      expect(sanitized).toContain("\\;");
      expect(sanitized).toContain("\\&\\&");
      expect(sanitized).toContain('\\"');
      expect(sanitized).toContain("\\|");
      expect(sanitized).toContain("\\$");
      expect(sanitized).toContain("\\>");
    });
  });

  describe("Keycode Resolution", () => {
    it("resolves all defined Android keycodes", () => {
      for (const [key, code] of Object.entries(ANDROID_KEYCODES)) {
        expect(GestureEngine.resolveKeycode(key)).toBe(code);
      }
    });

    it("normalizes case, whitespace, hyphens, and underscores", () => {
      expect(GestureEngine.resolveKeycode("  BACK  ")).toBe(4);
      expect(GestureEngine.resolveKeycode("Home")).toBe(3);
      expect(GestureEngine.resolveKeycode("VOLUME-UP")).toBe(24);
      expect(GestureEngine.resolveKeycode("volume down")).toBe(25);
      expect(GestureEngine.resolveKeycode("APP_SWITCH")).toBe(187);
      expect(GestureEngine.resolveKeycode("app switch")).toBe(187);
      expect(GestureEngine.resolveKeycode("app-switch")).toBe(187);
    });

    it("accepts numeric strings directly", () => {
      expect(GestureEngine.resolveKeycode("66")).toBe(66);
      expect(GestureEngine.resolveKeycode("123")).toBe(123);
      expect(GestureEngine.resolveKeycode("0")).toBe(0);
    });

    it("throws an informative error for unknown keys", () => {
      expect(() => GestureEngine.resolveKeycode("unknown_key_xyz")).toThrow(
        /Unknown Android key name: 'unknown_key_xyz'/
      );
      expect(() => GestureEngine.resolveKeycode("")).toThrow(
        /Unknown Android key name/
      );
    });
  });
});
