import {
  BaseInferenceProvider,
  GroundingResult,
  AssertionResult,
  LogSummaryResult,
  MacroActionStep,
  ScreenAnalysisResult,
  KeyElementInfo,
} from "./base.js";
import { InferenceProviderConfig } from "../config/schema.js";
import { logger } from "../utils/logger.js";

export class OllamaProvider extends BaseInferenceProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private model: string;
  private visionModel: string;
  private textModel: string;
  private timeoutMs: number;
  private temperature: number;
  private autoDetected = false;

  constructor(config: InferenceProviderConfig) {
    super();
    let url = config.baseUrl.replace(/\/+$/, "");
    if (url.endsWith("/v1")) {
      url = url.slice(0, -3);
    }
    this.baseUrl = url;
    this.model = config.model || "auto";
    this.visionModel = config.visionModel || this.model;
    this.textModel = config.textModel || this.model;
    this.timeoutMs = config.timeoutMs;
    this.temperature = config.temperature;
  }

  private async ensureModel(): Promise<void> {
    if (this.autoDetected || (this.visionModel !== "auto" && this.textModel !== "auto")) {
      return;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        if (data.models && data.models.length > 0) {
          const detected = data.models[0].name;
          if (this.visionModel === "auto") this.visionModel = detected;
          if (this.textModel === "auto") this.textModel = detected;
          if (this.model === "auto") this.model = detected;
          this.autoDetected = true;
          logger.debug(`Auto-detected Ollama model: ${detected}`);
        }
      }
    } catch {
      if (this.visionModel === "auto") this.visionModel = "default";
      if (this.textModel === "auto") this.textModel = "default";
    }
  }

  async checkHealth(): Promise<{
    ok: boolean;
    vlmModel: string;
    slmModel: string;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.ensureModel();
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          vlmModel: this.visionModel,
          slmModel: this.textModel,
          latencyMs,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      return {
        ok: true,
        vlmModel: this.visionModel,
        slmModel: this.textModel,
        latencyMs,
      };
    } catch (err) {
      return {
        ok: false,
        vlmModel: this.visionModel,
        slmModel: this.textModel,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async callOllamaChat(
    model: string,
    messages: Array<{ role: string; content: string; images?: string[] }>
  ): Promise<string> {
    await this.ensureModel();
    const effectiveModel = model === "auto" ? this.model : model;

    const payload = {
      model: effectiveModel,
      messages,
      format: "json",
      stream: false,
      options: {
        temperature: this.temperature,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama chat error (${res.status}): ${text}`);
      }

      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content || "";
    } finally {
      clearTimeout(timeout);
    }
  }

  async groundElement(
    targetDescription: string,
    imageBase64: string
  ): Promise<GroundingResult> {
    const prompt = `Locate the UI element "${targetDescription}" on this mobile screen.
Output strict JSON with normalized coordinates between 0 and 1000 for click point:
{
  "found": true,
  "thought": "brief location explanation",
  "point": [x, y],
  "confidence": 0.95
}`;

    try {
      const content = await this.callOllamaChat(this.visionModel, [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ]);

      const parsed = this.cleanAndParseJson(content) as {
        found?: boolean;
        thought?: string;
        point?: unknown;
        confidence?: number;
      } | null;

      if (parsed) {
        const point = this.parseNormalizedPoint(parsed.point);
        return {
          found: parsed.found ?? Boolean(point),
          point,
          confidence: parsed.confidence ?? 0.9,
          thought: parsed.thought,
        };
      }
    } catch (err) {
      logger.warn("Ollama grounding error:", err);
    }

    return { found: false, confidence: 0 };
  }

  async assertCondition(
    condition: string,
    imageBase64: string
  ): Promise<AssertionResult> {
    const prompt = `Verify if this condition is visually true: "${condition}".
Output JSON:
{
  "passed": true,
  "confidence": 0.95,
  "explanation": "why"
}`;

    try {
      const content = await this.callOllamaChat(this.visionModel, [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ]);
      const parsed = this.cleanAndParseJson(content) as {
        passed?: boolean;
        confidence?: number;
        explanation?: string;
      } | null;

      return {
        passed: Boolean(parsed?.passed),
        confidence: parsed?.confidence ?? 0.85,
        explanation: parsed?.explanation ?? "",
      };
    } catch (err) {
      logger.warn("Ollama assertion error:", err);
      return { passed: false, confidence: 0, explanation: String(err) };
    }
  }

  async summarizeLogAnomalies(rawLogs: string[]): Promise<LogSummaryResult> {
    if (rawLogs.length === 0) {
      return { hasFatalError: false, summary: "Empty log buffer." };
    }

    const sample = rawLogs.slice(-250).join("\n");
    const prompt = `Find fatal crashes or exceptions in these logs:
${sample}
Output JSON:
{
  "hasFatalError": true,
  "summary": "1-2 sentence summary",
  "culprit": "filename or exception",
  "stackSnippet": "key stack trace lines"
}`;

    try {
      const content = await this.callOllamaChat(this.textModel, [
        { role: "user", content: prompt },
      ]);
      const parsed = this.cleanAndParseJson(content) as {
        hasFatalError?: boolean;
        summary?: string;
        culprit?: string;
        stackSnippet?: string;
      } | null;

      return {
        hasFatalError: Boolean(parsed?.hasFatalError),
        summary: parsed?.summary ?? "Clean logs.",
        culprit: parsed?.culprit,
        stackSnippet: parsed?.stackSnippet,
      };
    } catch (err) {
      return { hasFatalError: false, summary: "Failed to parse logs with local model." };
    }
  }

  async decideNextAction(
    goal: string,
    stepIndex: number,
    actionHistory: string[],
    imageBase64: string
  ): Promise<MacroActionStep> {
    const prompt = `Goal: "${goal}". Step: ${stepIndex + 1}. History: ${actionHistory.join(", ")}.
Output next action JSON:
{
  "thought": "description",
  "action": "tap" | "type" | "swipe" | "key" | "done" | "fail",
  "point": [x, y],
  "text": "text to type",
  "direction": "up" | "down" | "left" | "right",
  "key": "back" | "home" | "enter"
}`;

    try {
      const content = await this.callOllamaChat(this.visionModel, [
        { role: "user", content: prompt, images: [imageBase64] },
      ]);
      const parsed = this.cleanAndParseJson(content) as {
        thought?: string;
        action?: MacroActionStep["action"];
        point?: unknown;
        text?: string;
        direction?: MacroActionStep["direction"];
        key?: string;
      } | null;

      const point = this.parseNormalizedPoint(parsed?.point);

      return {
        thought: parsed?.thought || "",
        action: parsed?.action || "fail",
        point,
        text: parsed?.text,
        direction: parsed?.direction,
        key: parsed?.key,
      };
    } catch (err) {
      return { thought: "Ollama action parsing failed", action: "fail" };
    }
  }

  async analyzeScreen(
    imageBase64: string,
    userPrompt?: string,
    focus: "all" | "scroll_state" | "elements" | "text" | "custom" = "all"
  ): Promise<ScreenAnalysisResult> {
    const prompt = `Analyze this screen image thoroughly without executing actions.
Focus area: "${focus}".
${userPrompt ? `Specific question/objective: "${userPrompt}"` : ""}

Output strict JSON:
{
  "screenSummary": "Concise 1-2 sentence description of current screen",
  "scrollState": {
    "isScrollable": true,
    "position": "top", // "top" | "middle" | "bottom" | "unknown"
    "canScrollUp": false,
    "canScrollDown": true,
    "scrollbarVisible": false
  },
  "visibleKeyElements": [
    {
      "label": "Element name or visible text",
      "type": "button", // "button" | "input" | "text" | "icon" | "list_item" | "header"
      "location": "header", // "header" | "footer" | "content" | "navigation" | "overlay" | "unknown"
      "point": [500, 200]
    }
  ],
  "hasActiveOverlay": false,
  "hasKeyboard": false,
  "confidence": 0.95
}`;

    try {
      const content = await this.callOllamaChat(this.visionModel, [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ]);

      const parsed = this.cleanAndParseJson(content) as Record<string, unknown> | null;
      if (parsed) {
        const scrollRaw = (parsed.scrollState as Record<string, unknown>) || {};
        const scrollPos = ["top", "middle", "bottom", "unknown"].includes(String(scrollRaw.position))
          ? (String(scrollRaw.position) as "top" | "middle" | "bottom" | "unknown")
          : "unknown";

        const keyElements: KeyElementInfo[] = Array.isArray(parsed.visibleKeyElements)
          ? (parsed.visibleKeyElements as Array<Record<string, unknown>>)
              .map((el) => ({
                label: String(el.label || ""),
                type: el.type ? String(el.type) : undefined,
                location: ["header", "footer", "content", "navigation", "overlay", "unknown"].includes(
                  String(el.location)
                )
                  ? (String(el.location) as any)
                  : undefined,
                point: this.parseNormalizedPoint(el.point),
              }))
              .filter((el) => Boolean(el.label))
          : [];

        return {
          screenSummary: String(parsed.screenSummary || "Screen analysis completed"),
          scrollState: {
            isScrollable: Boolean(scrollRaw.isScrollable),
            position: scrollPos,
            canScrollUp: Boolean(scrollRaw.canScrollUp),
            canScrollDown: Boolean(scrollRaw.canScrollDown),
            scrollbarVisible:
              typeof scrollRaw.scrollbarVisible === "boolean" ? scrollRaw.scrollbarVisible : undefined,
          },
          visibleKeyElements: keyElements,
          hasActiveOverlay: Boolean(parsed.hasActiveOverlay),
          hasKeyboard: typeof parsed.hasKeyboard === "boolean" ? parsed.hasKeyboard : undefined,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        };
      }
    } catch (err) {
      logger.warn("Ollama screen analysis error:", err);
    }

    return {
      screenSummary: "Screen analysis failed or unparseable",
      scrollState: {
        isScrollable: false,
        position: "unknown",
        canScrollUp: false,
        canScrollDown: false,
      },
      visibleKeyElements: [],
      hasActiveOverlay: false,
      confidence: 0,
    };
  }
}
