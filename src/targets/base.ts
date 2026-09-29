import { DisplayMetrics } from "../core/coordinate-mapper.js";
import { SwipeCoordinates } from "../core/gesture-engine.js";

export interface SemanticElement {
  id?: string;
  text?: string;
  contentDescription?: string;
  className?: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  clickable?: boolean;
}

export interface ScreenFrame {
  buffer: Buffer;
  base64: string;
  width: number;
  height: number;
}

export abstract class BaseTarget {
  abstract readonly name: string;

  abstract init(): Promise<void>;
  abstract getDisplayMetrics(forceRefresh?: boolean): Promise<DisplayMetrics>;
  abstract captureScreenshot(): Promise<ScreenFrame>;
  abstract getSemanticHierarchy(): Promise<SemanticElement[]>;
  abstract tap(x: number, y: number): Promise<void>;
  abstract swipe(coords: SwipeCoordinates): Promise<void>;
  abstract typeText(text: string): Promise<void>;
  abstract pressKey(key: string): Promise<void>;
  abstract getRecentLogs(filter?: string): Promise<string[]>;
  abstract checkCrashWatchdog(): Promise<{ hasCrashed: boolean; reason?: string }>;
  abstract close(): Promise<void>;
}
