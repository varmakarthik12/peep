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
  scrollable?: boolean;
}

export interface ScreenFrame {
  buffer: Buffer;
  base64: string;
  width: number;
  height: number;
}

export abstract class BaseTarget {
  abstract readonly name: string;
  isReady: boolean = true;
  readonly scaffoldNotice?: string;

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
  resetCrashWatchdog?(): void;
  abstract close(): Promise<void>;

  async findSemanticElement(query: string): Promise<SemanticElement | null> {
    const elements = await this.getSemanticHierarchy();
    const q = query.toLowerCase().trim();
    return (
      elements.find((el) => {
        if (el.text && el.text.toLowerCase().includes(q)) return true;
        if (el.contentDescription && el.contentDescription.toLowerCase().includes(q)) return true;
        if (el.id && el.id.toLowerCase().includes(q)) return true;
        return false;
      }) || null
    );
  }
}
