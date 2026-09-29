export interface DisplayMetrics {
  width: number;
  height: number;
  density?: number;
  rotation?: 0 | 90 | 180 | 270; // Android Surface.ROTATION_*
}

export interface NormalizedPoint {
  x: number; // 0 to 1000
  y: number; // 0 to 1000
}

export interface PhysicalPoint {
  x: number;
  y: number;
}

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class CoordinateMapper {
  private metrics: DisplayMetrics;
  private scale: number;

  constructor(metrics: DisplayMetrics, scale = 1000) {
    this.metrics = {
      ...metrics,
      rotation: metrics.rotation ?? 0,
    };
    this.scale = scale;
  }

  updateMetrics(metrics: DisplayMetrics): void {
    this.metrics = {
      ...metrics,
      rotation: metrics.rotation ?? 0,
    };
  }

  getMetrics(): DisplayMetrics {
    return { ...this.metrics };
  }

  /**
   * Returns effective screen dimensions accounting for rotation.
   * If rotation is 90 or 270 and unrotated portrait dimensions were provided,
   * width and height are appropriately swapped for active landscape display.
   */
  getEffectiveDimensions(): { width: number; height: number } {
    const { width, height, rotation = 0 } = this.metrics;
    const isRotated = rotation === 90 || rotation === 270;
    if (isRotated) {
      const displayW = width < height ? height : width;
      const displayH = width < height ? width : height;
      return { width: displayW, height: displayH };
    }
    return { width, height };
  }

  /**
   * Converts normalized model coordinates (e.g. 0-1000) to device physical screen coordinates.
   */
  toPhysicalPoint(
    norm: NormalizedPoint,
    options: {
      frameWidth?: number;
      frameHeight?: number;
      jitter?: boolean;
    } = {}
  ): PhysicalPoint {
    const { width, height } = this.metrics;

    // Clamp normalized values to [0, scale]
    const clampedX = Math.max(0, Math.min(this.scale, norm.x));
    const clampedY = Math.max(0, Math.min(this.scale, norm.y));

    // Base scaling
    let physX = (clampedX / this.scale) * width;
    let physY = (clampedY / this.scale) * height;

    // Compensate for letterboxing if frame aspect ratio differs from physical
    if (
      options.frameWidth &&
      options.frameHeight &&
      options.frameWidth > 0 &&
      options.frameHeight > 0
    ) {
      const frameAspect = options.frameWidth / options.frameHeight;
      const deviceAspect = width / height;

      if (Math.abs(frameAspect - deviceAspect) > 0.01) {
        if (frameAspect > deviceAspect) {
          // Horizontal letterbox (black bars on left/right)
          const activeWidth = options.frameHeight * deviceAspect;
          const padX = (options.frameWidth - activeWidth) / 2;
          const rawPx = (clampedX / this.scale) * options.frameWidth;
          physX = ((rawPx - padX) / activeWidth) * width;
        } else {
          // Vertical letterbox (black bars top/bottom)
          const activeHeight = options.frameWidth / deviceAspect;
          const padY = (options.frameHeight - activeHeight) / 2;
          const rawPy = (clampedY / this.scale) * options.frameHeight;
          physY = ((rawPy - padY) / activeHeight) * height;
        }
      }
    }

    // Apply rotation transformation if device is rotated
    const rotation = this.metrics.rotation;
    if (rotation === 90) {
      const origX = physX;
      physX = physY;
      physY = width - origX;
    } else if (rotation === 180) {
      physX = width - physX;
      physY = height - physY;
    } else if (rotation === 270) {
      const origX = physX;
      physX = height - physY;
      physY = origX;
    }

    // Optional humanized Gaussian jitter (anti-bot / anti-sticking)
    if (options.jitter) {
      const jitterX = (Math.random() - 0.5) * 3;
      const jitterY = (Math.random() - 0.5) * 3;
      physX += jitterX;
      physY += jitterY;
    }

    return {
      x: Math.round(Math.max(0, Math.min(width, physX))),
      y: Math.round(Math.max(0, Math.min(height, physY))),
    };
  }

  /**
   * Converts bounding box [l, t, r, b] in normalized scale to center PhysicalPoint.
   */
  boundingBoxToCenter(
    box: BoundingBox,
    options?: {
      frameWidth?: number;
      frameHeight?: number;
      jitter?: boolean;
    }
  ): PhysicalPoint {
    const centerNorm: NormalizedPoint = {
      x: (box.left + box.right) / 2,
      y: (box.top + box.bottom) / 2,
    };
    return this.toPhysicalPoint(centerNorm, options);
  }

  /**
   * Reverse conversion: Device physical coordinates to normalized (0-1000)
   */
  toNormalizedPoint(phys: PhysicalPoint): NormalizedPoint {
    const { width, height } = this.metrics;
    return {
      x: Math.round(Math.max(0, Math.min(this.scale, (phys.x / width) * this.scale))),
      y: Math.round(Math.max(0, Math.min(this.scale, (phys.y / height) * this.scale))),
    };
  }
}
