import { describe, it, expect } from "vitest";
import { CoordinateMapper } from "../src/core/coordinate-mapper.js";

describe("CoordinateMapper", () => {
  it("converts normalized coordinates (0-1000) to physical display points", () => {
    const mapper = new CoordinateMapper({ width: 1080, height: 2400 });

    // Center point (500, 500) -> (540, 1200)
    const center = mapper.toPhysicalPoint({ x: 500, y: 500 });
    expect(center.x).toBe(540);
    expect(center.y).toBe(1200);

    // Top-left (0, 0) -> (0, 0)
    const origin = mapper.toPhysicalPoint({ x: 0, y: 0 });
    expect(origin.x).toBe(0);
    expect(origin.y).toBe(0);

    // Bottom-right (1000, 1000) -> (1080, 2400)
    const max = mapper.toPhysicalPoint({ x: 1000, y: 1000 });
    expect(max.x).toBe(1080);
    expect(max.y).toBe(2400);
  });

  describe("Letterboxing math", () => {
    it("handles horizontal letterboxing (frame wider aspect than device)", () => {
      // Device aspect ratio = 1000 / 2000 = 0.5 (tall)
      // Frame aspect ratio = 1200 / 1200 = 1.0 (square frame, black bars on left/right)
      const mapper = new CoordinateMapper({ width: 1000, height: 2000 });

      // In a 1200x1200 frame with deviceAspect 0.5:
      // activeWidth = 1200 * 0.5 = 600
      // padX = (1200 - 600) / 2 = 300
      // normalized x=500 is center of frame (rawPx = 600)
      // physX = ((600 - 300) / 600) * 1000 = 500
      const center = mapper.toPhysicalPoint(
        { x: 500, y: 500 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(center.x).toBe(500);
      expect(center.y).toBe(1000);

      // Left active edge of device: rawPx = 300 -> normalized x = (300/1200)*1000 = 250
      const leftEdge = mapper.toPhysicalPoint(
        { x: 250, y: 500 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(leftEdge.x).toBe(0);

      // Right active edge of device: rawPx = 900 -> normalized x = (900/1200)*1000 = 750
      const rightEdge = mapper.toPhysicalPoint(
        { x: 750, y: 500 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(rightEdge.x).toBe(1000);
    });

    it("handles vertical letterboxing (frame taller aspect than device)", () => {
      // Device aspect ratio = 1200 / 600 = 2.0 (wide)
      // Frame aspect ratio = 1000 / 1000 = 1.0 (square frame, black bars on top/bottom)
      const mapper = new CoordinateMapper({ width: 1200, height: 600 });

      // activeHeight = 1000 / 2.0 = 500
      // padY = (1000 - 500) / 2 = 250
      // normalized y=500 is center of frame (rawPy = 500)
      // physY = ((500 - 250) / 500) * 600 = 300
      const center = mapper.toPhysicalPoint(
        { x: 500, y: 500 },
        { frameWidth: 1000, frameHeight: 1000 }
      );
      expect(center.x).toBe(600);
      expect(center.y).toBe(300);

      // Top active edge of device: rawPy = 250 -> normalized y = (250/1000)*1000 = 250
      const topEdge = mapper.toPhysicalPoint(
        { x: 500, y: 250 },
        { frameWidth: 1000, frameHeight: 1000 }
      );
      expect(topEdge.y).toBe(0);

      // Bottom active edge of device: rawPy = 750 -> normalized y = (750/1000)*1000 = 750
      const bottomEdge = mapper.toPhysicalPoint(
        { x: 500, y: 750 },
        { frameWidth: 1000, frameHeight: 1000 }
      );
      expect(bottomEdge.y).toBe(600);
    });

    it("does not apply letterbox adjustment when aspect ratios match within threshold", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2400 });
      // Exactly matching aspect ratio
      const ptMatch = mapper.toPhysicalPoint(
        { x: 500, y: 500 },
        { frameWidth: 540, frameHeight: 1200 }
      );
      expect(ptMatch.x).toBe(540);
      expect(ptMatch.y).toBe(1200);

      // Slightly different (delta <= 0.01)
      const ptClose = mapper.toPhysicalPoint(
        { x: 500, y: 500 },
        { frameWidth: 1081, frameHeight: 2400 }
      );
      expect(ptClose.x).toBe(540);
      expect(ptClose.y).toBe(1200);
    });
  });

  describe("Rotation transformations", () => {
    it("handles 90 degree rotation correctly", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000, rotation: 90 });
      // Point (100, 200) -> base physX = 100, base physY = 400
      // 90 deg: physX' = physY = 400, physY' = width - origX = 1000 - 100 = 900
      const pt = mapper.toPhysicalPoint({ x: 100, y: 200 });
      expect(pt.x).toBe(400);
      expect(pt.y).toBe(900);
    });

    it("handles 180 degree rotation correctly", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000, rotation: 180 });
      // Point (100, 200) -> base physX = 100, base physY = 400
      // 180 deg: physX' = width - physX = 900, physY' = height - physY = 1600
      const pt = mapper.toPhysicalPoint({ x: 100, y: 200 });
      expect(pt.x).toBe(900);
      expect(pt.y).toBe(1600);
    });

    it("handles 270 degree rotation correctly", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000, rotation: 270 });
      // Point (100, 200) -> base physX = 100, base physY = 400
      // 270 deg: physX' = height - physY = 2000 - 400 = 1600, clamped to width 1000; physY' = origX = 100
      const pt = mapper.toPhysicalPoint({ x: 100, y: 200 });
      expect(pt.x).toBe(1000);
      expect(pt.y).toBe(100);
    });
  });

  describe("Clamping, bounds and jitter edge cases", () => {
    it("clamps negative normalized coordinates to 0", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2400 });
      const pt = mapper.toPhysicalPoint({ x: -100, y: -50 });
      expect(pt.x).toBe(0);
      expect(pt.y).toBe(0);
    });

    it("clamps normalized coordinates exceeding scale to physical bounds", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2400 }, 1000);
      const pt = mapper.toPhysicalPoint({ x: 1500, y: 9999 });
      expect(pt.x).toBe(1080);
      expect(pt.y).toBe(2400);
    });

    it("keeps coordinates within screen bounds when jitter is enabled", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2400 });
      for (let i = 0; i < 20; i++) {
        const ptOrigin = mapper.toPhysicalPoint({ x: 0, y: 0 }, { jitter: true });
        expect(ptOrigin.x).toBeGreaterThanOrEqual(0);
        expect(ptOrigin.y).toBeGreaterThanOrEqual(0);

        const ptMax = mapper.toPhysicalPoint({ x: 1000, y: 1000 }, { jitter: true });
        expect(ptMax.x).toBeLessThanOrEqual(1080);
        expect(ptMax.y).toBeLessThanOrEqual(2400);
      }
    });

    it("calculates center of bounding box and handles edge cases", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000 });
      // Standard bounding box
      const center = mapper.boundingBoxToCenter({
        left: 100,
        top: 200,
        right: 300,
        bottom: 400,
      });
      expect(center.x).toBe(200);
      expect(center.y).toBe(600);

      // Zero-width/height bounding box (single point)
      const pointBox = mapper.boundingBoxToCenter({
        left: 500,
        top: 500,
        right: 500,
        bottom: 500,
      });
      expect(pointBox.x).toBe(500);
      expect(pointBox.y).toBe(1000);
    });

    it("updates display metrics dynamically", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000 });
      expect(mapper.getMetrics().width).toBe(1000);

      mapper.updateMetrics({ width: 1440, height: 3200, rotation: 90 });
      const metrics = mapper.getMetrics();
      expect(metrics.width).toBe(1440);
      expect(metrics.height).toBe(3200);
      expect(metrics.rotation).toBe(90);

      const pt = mapper.toPhysicalPoint({ x: 500, y: 500 });
      // physX' = physY = 1600, clamped to width 1440
      expect(pt.x).toBe(1440);
      expect(pt.y).toBe(720);
    });

    it("performs reverse transformation from physical to normalized", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2160 });
      const norm = mapper.toNormalizedPoint({ x: 540, y: 1080 });
      expect(norm.x).toBe(500);
      expect(norm.y).toBe(500);

      const normOrigin = mapper.toNormalizedPoint({ x: 0, y: 0 });
      expect(normOrigin.x).toBe(0);
      expect(normOrigin.y).toBe(0);
    });
  });
});
