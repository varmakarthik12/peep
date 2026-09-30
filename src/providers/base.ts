import { NormalizedPoint, BoundingBox } from "../core/coordinate-mapper.js";

export interface GroundingResult {
  found: boolean;
  point?: NormalizedPoint;
  box?: BoundingBox;
  confidence: number;
  thought?: string;
}

export interface AssertionResult {
  passed: boolean;
  confidence: number;
  explanation: string;
}

export interface LogSummaryResult {
  hasFatalError: boolean;
  summary: string;
  culprit?: string;
  stackSnippet?: string;
}

export interface ScrollStateEstimate {
  isScrollable: boolean;
  position: "top" | "middle" | "bottom" | "unknown";
  canScrollUp: boolean;
  canScrollDown: boolean;
  scrollbarVisible?: boolean;
}

export interface KeyElementInfo {
  label: string;
  type?: string;
  location?: "header" | "footer" | "content" | "navigation" | "overlay" | "unknown";
  point?: NormalizedPoint;
  box?: BoundingBox;
}

export interface ScreenAnalysisResult {
  screenSummary: string;
  scrollState: ScrollStateEstimate;
  visibleKeyElements: KeyElementInfo[];
  hasActiveOverlay: boolean;
  hasKeyboard?: boolean;
  confidence: number;
}

export interface MacroActionStep {
  thought: string;
  action: "tap" | "type" | "swipe" | "key" | "wait" | "done" | "fail";
  point?: NormalizedPoint;
  target?: string;
  text?: string;
  direction?: "up" | "down" | "left" | "right";
  key?: string;
}

export abstract class BaseInferenceProvider {
  abstract readonly name: string;

  abstract checkHealth(): Promise<{
    ok: boolean;
    vlmModel: string;
    slmModel: string;
    latencyMs: number;
    error?: string;
  }>;

  /**
   * Grounds a target visual element on the screen.
   * Returns normalized coordinates [0-1000].
   */
  abstract groundElement(
    targetDescription: string,
    imageBase64: string
  ): Promise<GroundingResult>;

  /**
   * Asserts whether a visual condition is true on the screen.
   */
  abstract assertCondition(
    condition: string,
    imageBase64: string
  ): Promise<AssertionResult>;

  /**
   * Summarizes log buffer lines into a 3-line diagnostic.
   */
  abstract summarizeLogAnomalies(
    rawLogs: string[]
  ): Promise<LogSummaryResult>;

  /**
   * Autonomous agent decision step for local micro-loops.
   */
  abstract decideNextAction(
    goal: string,
    stepIndex: number,
    actionHistory: string[],
    imageBase64: string
  ): Promise<MacroActionStep>;

  /**
   * Performs purely visual or multimodal screen analysis (summary, scroll state, visible elements, modals).
   */
  abstract analyzeScreen(
    imageBase64: string,
    prompt?: string,
    focus?: "all" | "scroll_state" | "elements" | "text" | "custom"
  ): Promise<ScreenAnalysisResult>;

  /**
   * Resiliently extracts and parses JSON from model responses, handling raw JSON,
   * markdown code blocks, and enclosing braces.
   */
  cleanAndParseJson(text: string): Record<string, unknown> | null {
    try {
      return JSON.parse(text.trim());
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch {
          // ignore
        }
      }

      const braceMatch = text.match(/(\{[\s\S]*\})/);
      if (braceMatch && braceMatch[1]) {
        try {
          return JSON.parse(braceMatch[1].trim());
        } catch {
          // ignore
        }
      }
    }
    return null;
  }

  /**
   * Validates and parses normalized point [x, y] or {x, y} coordinates, guarding against NaN and non-numbers.
   */
  parseNormalizedPoint(pointVal: unknown): NormalizedPoint | undefined {
    if (!pointVal) return undefined;
    if (Array.isArray(pointVal) && pointVal.length >= 2) {
      const px = Number(pointVal[0]);
      const py = Number(pointVal[1]);
      if (!isNaN(px) && !isNaN(py) && isFinite(px) && isFinite(py)) {
        return { x: Math.round(px), y: Math.round(py) };
      }
    } else if (typeof pointVal === "object" && pointVal !== null && "x" in pointVal && "y" in pointVal) {
      const p = pointVal as { x: unknown; y: unknown };
      const px = Number(p.x);
      const py = Number(p.y);
      if (!isNaN(px) && !isNaN(py) && isFinite(px) && isFinite(py)) {
        return { x: Math.round(px), y: Math.round(py) };
      }
    }
    return undefined;
  }
}
