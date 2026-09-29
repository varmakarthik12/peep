import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProvider, OpenAICompatibleProvider, OllamaProvider } from "../src/providers/index.js";

describe("Inference Providers", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("Base URL Normalization", () => {
    it("creates OpenAI-compatible provider with normalized baseUrl (appending /v1 and removing trailing slashes)", () => {
      const provider1 = createProvider({
        type: "openai",
        baseUrl: "http://localhost:11434///",
        vlmModel: "qwen2.5-vl:7b",
        slmModel: "gemma:2b",
        timeoutMs: 30000,
        temperature: 0.1,
      }) as OpenAICompatibleProvider;

      expect(provider1.name).toBe("openai_compatible");
      expect((provider1 as unknown as { baseUrl: string }).baseUrl).toBe("http://localhost:11434/v1");

      const provider2 = createProvider({
        type: "openai",
        baseUrl: "https://api.openai.com/v1/",
        vlmModel: "gpt-4o",
        slmModel: "gpt-4o-mini",
        timeoutMs: 30000,
        temperature: 0.1,
      }) as OpenAICompatibleProvider;

      expect((provider2 as unknown as { baseUrl: string }).baseUrl).toBe("https://api.openai.com/v1");
    });

    it("creates native Ollama provider with normalized baseUrl (stripping /v1 and trailing slashes)", () => {
      const provider = createProvider({
        type: "ollama",
        baseUrl: "http://localhost:11434/v1///",
        vlmModel: "qwen2.5-vl:7b",
        slmModel: "gemma:2b",
        timeoutMs: 30000,
        temperature: 0.1,
      }) as OllamaProvider;

      expect(provider.name).toBe("ollama");
      expect((provider as unknown as { baseUrl: string }).baseUrl).toBe("http://localhost:11434");
    });
  });

  describe("JSON Extraction & Parsing (cleanAndParseJson)", () => {
    const provider = new OpenAICompatibleProvider({
      type: "openai",
      baseUrl: "http://localhost:11434/v1",
      vlmModel: "qwen2.5-vl:7b",
      slmModel: "gemma:2b",
      timeoutMs: 30000,
      temperature: 0.1,
    });

    const cleanAndParse = (text: string) =>
      (provider as unknown as { cleanAndParseJson: (t: string) => Record<string, unknown> | null }).cleanAndParseJson(text);

    it("parses raw direct JSON string", () => {
      const res = cleanAndParse('{"found": true, "point": [500, 600]}');
      expect(res).toEqual({ found: true, point: [500, 600] });
    });

    it("extracts JSON enclosed in markdown code fences", () => {
      const markdown = "```json\n{\n  \"found\": true,\n  \"confidence\": 0.95\n}\n```";
      const res = cleanAndParse(markdown);
      expect(res).toEqual({ found: true, confidence: 0.95 });
    });

    it("extracts JSON enclosed in markdown code fences without language tag", () => {
      const markdown = "```\n{\n  \"action\": \"tap\"\n}\n```";
      const res = cleanAndParse(markdown);
      expect(res).toEqual({ action: "tap" });
    });

    it("extracts JSON with conversational text before and after", () => {
      const text = "Sure! Here is the grounding result: {\"found\": false, \"thought\": \"button not on screen\"} Hope that helps!";
      const res = cleanAndParse(text);
      expect(res).toEqual({ found: false, thought: "button not on screen" });
    });

    it("returns null for completely invalid or empty inputs", () => {
      expect(cleanAndParse("")).toBeNull();
      expect(cleanAndParse("   ")).toBeNull();
      expect(cleanAndParse("Sorry, I cannot process this image.")).toBeNull();
      expect(cleanAndParse("{ bad json: missing quotes }")).toBeNull();
    });
  });

  describe("Health Check via HTTP", () => {
    const config = {
      type: "openai" as const,
      baseUrl: "http://localhost:11434/v1",
      vlmModel: "qwen2.5-vl:7b",
      slmModel: "gemma:2b",
      timeoutMs: 5000,
      temperature: 0.1,
    };

    it("returns ok: true when backend returns HTTP 200", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "qwen2.5-vl:7b" }] }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const health = await provider.checkHealth();

      expect(health.ok).toBe(true);
      expect(health.vlmModel).toBe("qwen2.5-vl:7b");
      expect(health.error).toBeUndefined();
    });

    it("returns ok: false when backend returns HTTP error status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const health = await provider.checkHealth();

      expect(health.ok).toBe(false);
      expect(health.error).toContain("HTTP 502: Bad Gateway");
    });

    it("returns ok: false when network connection is refused", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const provider = new OpenAICompatibleProvider(config);
      const health = await provider.checkHealth();

      expect(health.ok).toBe(false);
      expect(health.error).toContain("ECONNREFUSED");
    });
  });

  describe("Visual Grounding and Assertion Execution", () => {
    const config = {
      type: "openai" as const,
      baseUrl: "http://localhost:11434/v1",
      vlmModel: "qwen2.5-vl:7b",
      slmModel: "gemma:2b",
      timeoutMs: 5000,
      temperature: 0.1,
    };

    it("grounds element successfully when model returns valid point", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  found: true,
                  thought: "Blue submit button in lower screen",
                  point: [520, 850],
                  confidence: 0.94,
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.groundElement("Submit button", "base64image");

      expect(res.found).toBe(true);
      expect(res.point).toEqual({ x: 520, y: 850 });
      expect(res.confidence).toBe(0.94);
      expect(res.thought).toBe("Blue submit button in lower screen");
    });

    it("handles point given as object {x, y}", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  found: true,
                  thought: "Found at point",
                  point: { x: 300, y: 400 },
                  confidence: 0.88,
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.groundElement("Search", "base64image");

      expect(res.found).toBe(true);
      expect(res.point).toEqual({ x: 300, y: 400 });
    });

    it("handles model returning found: false gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  found: false,
                  thought: "Element not visible",
                  point: null,
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.groundElement("Settings", "base64image");

      expect(res.found).toBe(false);
      expect(res.point).toBeUndefined();
    });

    it("evaluates visual assertions correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  passed: true,
                  confidence: 0.99,
                  explanation: "Order Confirmation dialog is clearly displayed in center",
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.assertCondition("Order confirmed", "base64image");

      expect(res.passed).toBe(true);
      expect(res.confidence).toBe(0.99);
      expect(res.explanation).toContain("Order Confirmation dialog");
    });
  });
});
