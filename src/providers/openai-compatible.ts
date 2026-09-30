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

export class OpenAICompatibleProvider extends BaseInferenceProvider {
  readonly name = "openai_compatible";
  private baseUrl: string;
  private apiKey?: string;
  private model: string;
  private visionModel: string;
  private textModel: string;
  private timeoutMs: number;
  private temperature: number;
  private autoDetected = false;

  constructor(config: InferenceProviderConfig) {
    super();
    let url = config.baseUrl.replace(/\/+$/, "");
    if (!url.endsWith("/v1")) {
      url = `${url}/v1`;
    }
    this.baseUrl = url;
    this.apiKey = config.apiKey;
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }>; models?: Array<{ name?: string; model?: string }> };
        const modelList = data.data || data.models || [];
        if (modelList.length > 0) {
          const first = modelList[0];
          const detectedId = ("id" in first && first.id) || ("name" in first && first.name) || ("model" in first && first.model) || "";
          if (detectedId) {
            if (this.visionModel === "auto") this.visionModel = detectedId;
            if (this.textModel === "auto") this.textModel = detectedId;
            if (this.model === "auto") this.model = detectedId;
            this.autoDetected = true;
            logger.debug(`Auto-detected model from endpoint: ${detectedId}`);
          }
        }
      }
    } catch {
      // Fallback default
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers,
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

  private async callChat(
    model: string,
    messages: Array<Record<string, unknown>>,
    formatJson = false
  ): Promise<string> {
    await this.ensureModel();
    const effectiveModel = model === "auto" ? this.model : model;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const payload: Record<string, unknown> = {
      model: effectiveModel,
      messages,
      temperature: this.temperature,
    };

    if (formatJson) {
      payload.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Inference endpoint error (${res.status} ${res.statusText}): ${errText}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content || "";
    } finally {
      clearTimeout(timeout);
    }
  }

  async groundElement(
    targetDescription: string,
    imageBase64: string
  ): Promise<GroundingResult> {
    const prompt = `You are a high-precision UI visual grounding engine.
Analyze the provided mobile screen image and locate the UI element: "${targetDescription}".

Respond ONLY with a valid JSON object in this exact format:
{
  "found": true,
  "thought": "Brief visual description of where it is",
  "point": [x, y],
  "confidence": 0.95
}
Notes:
- "point" MUST be normalized coordinates between 0 and 1000, representing the click center of the element [x, y].
- Top-left is [0, 0], bottom-right is [1000, 1000].
- If the element is not visible or cannot be found, set "found": false, "point": null.`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ];

    try {
      const raw = await this.callChat(this.visionModel, messages, true);
      const parsed = this.cleanAndParseJson(raw);

      if (parsed && typeof parsed === "object") {
        const found = Boolean(parsed.found ?? true);
        const thought = typeof parsed.thought === "string" ? parsed.thought : "";
        const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.85;
        const point = this.parseNormalizedPoint(parsed.point);

        return {
          found: Boolean(found && point),
          point,
          confidence,
          thought,
        };
      }
    } catch (err) {
      logger.warn(`Vision grounding failed:`, err);
    }

    return {
      found: false,
      confidence: 0,
      thought: `Could not ground target: ${targetDescription}`,
    };
  }

  async assertCondition(
    condition: string,
    imageBase64: string
  ): Promise<AssertionResult> {
    const prompt = `You are a visual assertion engine for automated software testing.
Evaluate whether the following visual assertion is TRUE or FALSE on this mobile screen:
"${condition}"

Respond ONLY with a valid JSON object in this exact format:
{
  "passed": true,
  "confidence": 0.98,
  "explanation": "State what visual elements confirm or refute the assertion"
}`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ];

    try {
      const raw = await this.callChat(this.visionModel, messages, true);
      const parsed = this.cleanAndParseJson(raw);

      if (parsed && typeof parsed === "object") {
        return {
          passed: Boolean(parsed.passed),
          confidence: Number(parsed.confidence ?? 0.8),
          explanation: String(parsed.explanation ?? ""),
        };
      }
    } catch (err) {
      logger.warn(`Visual assertion error:`, err);
    }

    return {
      passed: false,
      confidence: 0,
      explanation: `Assertion evaluation failed.`,
    };
  }

  async summarizeLogAnomalies(rawLogs: string[]): Promise<LogSummaryResult> {
    if (rawLogs.length === 0) {
      return { hasFatalError: false, summary: "No log events recorded in active buffer." };
    }

    const sample = rawLogs.slice(-250).join("\n");
    const prompt = `You are a specialized crash and diagnostic analysis agent.
Analyze the following filtered log stream for fatal exceptions, unhandled crashes, ANRs, or critical network failures.

LOG SAMPLE:
${sample}

Respond ONLY with a valid JSON object in this exact format:
{
  "hasFatalError": true,
  "summary": "1-2 sentence ultra-compact summary of the error and cause",
  "culprit": "File:Line or Exception class name",
  "stackSnippet": "Top 2-3 most relevant stack trace lines"
}`;

    const messages = [{ role: "user", content: prompt }];

    try {
      const raw = await this.callChat(this.textModel, messages, true);
      const parsed = this.cleanAndParseJson(raw);

      if (parsed && typeof parsed === "object") {
        return {
          hasFatalError: Boolean(parsed.hasFatalError),
          summary: String(parsed.summary ?? ""),
          culprit: parsed.culprit ? String(parsed.culprit) : undefined,
          stackSnippet: parsed.stackSnippet ? String(parsed.stackSnippet) : undefined,
        };
      }
    } catch (err) {
      logger.warn(`Log summarization error:`, err);
    }

    return {
      hasFatalError: false,
      summary: "Logs parsed without detecting fatal crashes.",
    };
  }

  async decideNextAction(
    goal: string,
    stepIndex: number,
    actionHistory: string[],
    imageBase64: string
  ): Promise<MacroActionStep> {
    const prompt = `You are an autonomous UI execution agent driving a device.
User Goal: "${goal}"
Current Step: ${stepIndex + 1}
Action History:
${actionHistory.length > 0 ? actionHistory.map((a, i) => `  ${i + 1}. ${a}`).join("\n") : "  (Starting flow)"}

Analyze the current screen and decide the next single action to make progress toward the goal.
Respond ONLY with a valid JSON object:
{
  "thought": "Explain what you observe on screen and what action to take",
  "action": "tap" | "type" | "swipe" | "key" | "wait" | "done" | "fail",
  "point": [x, y], // Normalized [0-1000, 0-1000] if action is tap
  "text": "text to type if action is type",
  "direction": "up" | "down" | "left" | "right", // if action is swipe
  "key": "back" | "home" | "enter" // if action is key
}`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ];

    try {
      const raw = await this.callChat(this.visionModel, messages, true);
      const parsed = this.cleanAndParseJson(raw);

      if (parsed && typeof parsed === "object") {
        const action = String(parsed.action || "fail") as MacroActionStep["action"];
        const point = this.parseNormalizedPoint(parsed.point);

        return {
          thought: String(parsed.thought || ""),
          action,
          point,
          text: parsed.text ? String(parsed.text) : undefined,
          direction: parsed.direction as MacroActionStep["direction"],
          key: parsed.key ? String(parsed.key) : undefined,
        };
      }
    } catch (err) {
      logger.warn(`Autonomous action decision error:`, err);
    }

    return {
      thought: "Failed to determine next autonomous action.",
      action: "fail",
    };
  }

  async analyzeScreen(
    imageBase64: string,
    userPrompt?: string,
    focus: "all" | "scroll_state" | "elements" | "text" | "custom" = "all"
  ): Promise<ScreenAnalysisResult> {
    const prompt = `You are a high-precision mobile/desktop UI visual perception engine.
Analyze the provided screen image thoroughly without executing actions.
Focus area: "${focus}".
${userPrompt ? `Specific question/objective: "${userPrompt}"` : ""}

Respond ONLY with a valid JSON object in this exact format:
{
  "screenSummary": "Concise 1-2 sentence description of current screen/dialog/state",
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
      "point": [500, 200] // normalized center coordinates [0-1000]
    }
  ],
  "hasActiveOverlay": false,
  "hasKeyboard": false,
  "confidence": 0.95
}
Notes:
- "position" should be:
  * "top" if content is at the top or cannot scroll up
  * "bottom" if content is at the end or cannot scroll down
  * "middle" if both canScrollUp and canScrollDown are true
  * "unknown" if not scrollable or unable to determine
- "point" are normalized coordinates [0-1000] for element centers if identifiable.
- Set "hasActiveOverlay" to true if a modal, dialog, permission prompt, or popup is currently active.
- Set "hasKeyboard" to true if an on-screen soft keyboard is currently visible.`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ];

    try {
      const raw = await this.callChat(this.visionModel, messages, true);
      const parsed = this.cleanAndParseJson(raw);
      if (!parsed) {
        return {
          screenSummary: raw.trim().slice(0, 200) || "Unable to parse screen analysis",
          scrollState: {
            isScrollable: false,
            position: "unknown",
            canScrollUp: false,
            canScrollDown: false,
          },
          visibleKeyElements: [],
          hasActiveOverlay: false,
          confidence: 0.5,
        };
      }

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
    } catch (err) {
      logger.warn(`Screen analysis inference error: ${err instanceof Error ? err.message : String(err)}`);
      return {
        screenSummary: "Screen analysis failed due to inference error",
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
}

