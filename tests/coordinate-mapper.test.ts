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

  describe("getEffectiveDimensions and rotation metrics", () => {
    it("returns unrotated dimensions for 0 and 180 degrees", () => {
      const mapper0 = new CoordinateMapper({ width: 1080, height: 2400, rotation: 0 });
      expect(mapper0.getEffectiveDimensions()).toEqual({ width: 1080, height: 2400 });

      const mapper180 = new CoordinateMapper({ width: 1080, height: 2400, rotation: 180 });
      expect(mapper180.getEffectiveDimensions()).toEqual({ width: 1080, height: 2400 });
    });

    it("swaps dimensions for 90 and 270 degrees in portrait base metrics", () => {
      const mapper90 = new CoordinateMapper({ width: 1080, height: 2400, rotation: 90 });
      expect(mapper90.getEffectiveDimensions()).toEqual({ width: 2400, height: 1080 });

      const mapper270 = new CoordinateMapper({ width: 1080, height: 2400, rotation: 270 });
      expect(mapper270.getEffectiveDimensions()).toEqual({ width: 2400, height: 1080 });
    });

    it("handles 90 degrees when base metrics are already landscape", () => {
      const mapperLandscape = new CoordinateMapper({ width: 2400, height: 1080, rotation: 90 });
      expect(mapperLandscape.getEffectiveDimensions()).toEqual({ width: 2400, height: 1080 });
    });

    it("defaults rotation to 0 if not provided in metrics", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 1920 });
      expect(mapper.getMetrics().rotation).toBe(0);
      expect(mapper.getEffectiveDimensions()).toEqual({ width: 1080, height: 1920 });
    });
  });

  describe("Letterboxing math edge cases", () => {
    it("clamps normalized coordinates inside horizontal black bars (outside active area)", () => {
      // Device: 1000x2000 (aspect 0.5), Frame: 1200x1200 (aspect 1.0)
      // activeWidth = 600, padX = 300
      // Left bar spans rawPx [0, 300) -> normX in [0, 250)
      // Right bar spans rawPx (900, 1200] -> normX in (750, 1000]
      const mapper = new CoordinateMapper({ width: 1000, height: 2000 });

      // Click well inside left black bar (normX = 50 -> rawPx = 60)
      const leftBarClick = mapper.toPhysicalPoint(
        { x: 50, y: 500 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(leftBarClick.x).toBe(0); // Clamped to 0
      expect(leftBarClick.y).toBe(1000);

      // Click well inside right black bar (normX = 950 -> rawPx = 1140)
      const rightBarClick = mapper.toPhysicalPoint(
        { x: 950, y: 500 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(rightBarClick.x).toBe(1000); // Clamped to max physical width
      expect(rightBarClick.y).toBe(1000);
    });

    it("clamps normalized coordinates inside vertical black bars (outside active area)", () => {
      // Device: 1200x600 (aspect 2.0), Frame: 1000x1000 (aspect 1.0)
      // activeHeight = 500, padY = 250
      // Top bar spans rawPy [0, 250) -> normY in [0, 250)
      // Bottom bar spans rawPy (750, 1000] -> normY in (750, 1000]
      const mapper = new CoordinateMapper({ width: 1200, height: 600 });

      // Click well inside top black bar (normY = 50 -> rawPy = 50)
      const topBarClick = mapper.toPhysicalPoint(
        { x: 500, y: 50 },
        { frameWidth: 1000, frameHeight: 1000 }
      );
      expect(topBarClick.x).toBe(600);
      expect(topBarClick.y).toBe(0); // Clamped to top

      // Click well inside bottom black bar (normY = 950 -> rawPy = 950)
      const bottomBarClick = mapper.toPhysicalPoint(
        { x: 500, y: 950 },
        { frameWidth: 1000, frameHeight: 1000 }
      );
      expect(bottomBarClick.x).toBe(600);
      expect(bottomBarClick.y).toBe(600); // Clamped to bottom
    });

    it("bypasses letterbox adjustment safely if frame dimensions are zero or negative", () => {
      const mapper = new CoordinateMapper({ width: 1080, height: 2400 });

      const resZero = mapper.toPhysicalPoint({ x: 500, y: 500 }, { frameWidth: 0, frameHeight: 0 });
      expect(resZero.x).toBe(540);
      expect(resZero.y).toBe(1200);

      const resNegative = mapper.toPhysicalPoint({ x: 500, y: 500 }, { frameWidth: -500, frameHeight: -500 });
      expect(resNegative.x).toBe(540);
      expect(resNegative.y).toBe(1200);
    });

    it("handles inverted and out-of-bounds bounding boxes", () => {
      const mapper = new CoordinateMapper({ width: 1000, height: 2000 });

      // Inverted bounding box (left > right, top > bottom)
      const invertedBox = mapper.boundingBoxToCenter({
        left: 800,
        top: 900,
        right: 200,
        bottom: 100,
      });
      // Center: (800+200)/2 = 500 -> 500, (900+100)/2 = 500 -> 1000
      expect(invertedBox.x).toBe(500);
      expect(invertedBox.y).toBe(1000);

      // Out of bounds box on negative side
      const negativeBox = mapper.boundingBoxToCenter({
        left: -300,
        top: -200,
        right: -100,
        bottom: -50,
      });
      expect(negativeBox.x).toBe(0);
      expect(negativeBox.y).toBe(0);

      // Bounding box with letterboxing options passed through
      const letterboxedBox = mapper.boundingBoxToCenter(
        { left: 450, top: 450, right: 550, bottom: 550 },
        { frameWidth: 1200, frameHeight: 1200 }
      );
      expect(letterboxedBox.x).toBe(500);
      expect(letterboxedBox.y).toBe(1000);
    });
  });
});
