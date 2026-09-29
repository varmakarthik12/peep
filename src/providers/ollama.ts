import {
  BaseInferenceProvider,
  GroundingResult,
  AssertionResult,
  LogSummaryResult,
  MacroActionStep,
} from "./base.js";
import { InferenceProviderConfig } from "../config/schema.js";
import { logger } from "../utils/logger.js";

export class OllamaProvider extends BaseInferenceProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private vlmModel: string;
  private slmModel: string;
  private timeoutMs: number;
  private temperature: number;

  constructor(config: InferenceProviderConfig) {
    super();
    let url = config.baseUrl.replace(/\/+$/, "");
    if (url.endsWith("/v1")) {
      url = url.slice(0, -3);
    }
    this.baseUrl = url;
    this.vlmModel = config.vlmModel;
    this.slmModel = config.slmModel;
    this.timeoutMs = config.timeoutMs;
    this.temperature = config.temperature;
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
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return {
          ok: false,
          vlmModel: this.vlmModel,
          slmModel: this.slmModel,
          latencyMs: Date.now() - start,
          error: `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      return {
        ok: true,
        vlmModel: this.vlmModel,
        slmModel: this.slmModel,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        vlmModel: this.vlmModel,
        slmModel: this.slmModel,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async callOllamaChat(
    model: string,
    messages: Array<{ role: string; content: string; images?: string[] }>
  ): Promise<string> {
    const payload = {
      model,
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
      const content = await this.callOllamaChat(this.vlmModel, [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ]);

      const parsed = this.cleanAndParseJson(content);

      if (parsed) {
        const point = this.parseNormalizedPoint(parsed.point);
        return {
          found: Boolean((parsed.found ?? true) && point),
          point,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
          thought: typeof parsed.thought === "string" ? parsed.thought : undefined,
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
      const content = await this.callOllamaChat(this.vlmModel, [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ]);
      const parsed = this.cleanAndParseJson(content);

      if (parsed) {
        return {
          passed: Boolean(parsed.passed),
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
          explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
        };
      }
    } catch (err) {
      logger.warn("Ollama assertion error:", err);
      return { passed: false, confidence: 0, explanation: String(err) };
    }

    return { passed: false, confidence: 0, explanation: "Failed to evaluate assertion." };
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
      const content = await this.callOllamaChat(this.slmModel || this.vlmModel, [
        { role: "user", content: prompt },
      ]);
      const parsed = this.cleanAndParseJson(content);

      if (parsed) {
        return {
          hasFatalError: Boolean(parsed.hasFatalError),
          summary: typeof parsed.summary === "string" ? parsed.summary : "Clean logs.",
          culprit: parsed.culprit ? String(parsed.culprit) : undefined,
          stackSnippet: parsed.stackSnippet ? String(parsed.stackSnippet) : undefined,
        };
      }
    } catch (err) {
      return { hasFatalError: false, summary: "Failed to parse logs with local model." };
    }

    return { hasFatalError: false, summary: "Clean logs." };
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
      const content = await this.callOllamaChat(this.vlmModel, [
        { role: "user", content: prompt, images: [imageBase64] },
      ]);
      const parsed = this.cleanAndParseJson(content);

      if (parsed) {
        const point = this.parseNormalizedPoint(parsed.point);
        return {
          thought: typeof parsed.thought === "string" ? parsed.thought : "",
          action: (parsed.action as MacroActionStep["action"]) || "fail",
          point,
          text: parsed.text ? String(parsed.text) : undefined,
          direction: parsed.direction as MacroActionStep["direction"],
          key: parsed.key ? String(parsed.key) : undefined,
        };
      }
    } catch (err) {
      return { thought: "Ollama action parsing failed", action: "fail" };
    }

    return { thought: "Failed to determine next action", action: "fail" };
  }
}
