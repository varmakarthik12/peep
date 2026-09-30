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
        vlmModel: "mock-vision-model",
        slmModel: "mock-text-model",
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

    it("analyzeScreen analyzes visual layout, scroll state, and key elements", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  screenSummary: "Settings overview with network and battery options",
                  scrollState: {
                    isScrollable: true,
                    position: "top",
                    canScrollUp: false,
                    canScrollDown: true,
                    scrollbarVisible: true,
                  },
                  visibleKeyElements: [
                    { label: "Network & internet", type: "list_item", point: [500, 200] },
                    { label: "Battery", type: "list_item", point: [500, 400] },
                  ],
                  hasActiveOverlay: false,
                  hasKeyboard: false,
                  confidence: 0.95,
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.analyzeScreen("base64image", "Check network setting", "all");

      expect(res.screenSummary).toContain("Settings overview");
      expect(res.scrollState.isScrollable).toBe(true);
      expect(res.scrollState.position).toBe("top");
      expect(res.scrollState.canScrollDown).toBe(true);
      expect(res.visibleKeyElements).toHaveLength(2);
      expect(res.visibleKeyElements[0].label).toBe("Network & internet");
      expect(res.hasActiveOverlay).toBe(false);
      expect(res.confidence).toBe(0.95);
    });

    it("summarizeLogAnomalies returns clean fallback when logs array is empty", async () => {
      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.summarizeLogAnomalies([]);

      expect(res.hasFatalError).toBe(false);
      expect(res.summary).toContain("No log events recorded");
    });

    it("summarizeLogAnomalies parses structured anomaly diagnosis from model", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  hasFatalError: true,
                  summary: "App crashed with NullPointerException in AuthRepository",
                  culprit: "AuthRepository.kt:42",
                  stackSnippet: "at com.example.app.AuthRepository.login(AuthRepository.kt:42)",
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.summarizeLogAnomalies([
        "E/AndroidRuntime: FATAL EXCEPTION: main",
        "E/AndroidRuntime: java.lang.NullPointerException: Null session token",
        "E/AndroidRuntime: \tat com.example.app.AuthRepository.login(AuthRepository.kt:42)",
      ]);

      expect(res.hasFatalError).toBe(true);
      expect(res.summary).toContain("NullPointerException in AuthRepository");
      expect(res.culprit).toBe("AuthRepository.kt:42");
    });

    it("decideNextAction recommends next micro-loop action step", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  thought: "Screen displays Checkout button in bottom-right",
                  action: "tap",
                  point: [750, 920],
                }),
              },
            },
          ],
        }),
      } as Response);

      const provider = new OpenAICompatibleProvider(config);
      const res = await provider.decideNextAction("Proceed to payment", 0, [], "base64image");

      expect(res.action).toBe("tap");
      expect(res.thought).toContain("Checkout button");
      expect(res.point).toEqual({ x: 750, y: 920 });
    });
  });

  describe("OllamaProvider Execution", () => {
    const ollamaConfig = {
      type: "ollama" as const,
      baseUrl: "http://localhost:11434",
      vlmModel: "qwen2.5-vl:7b",
      slmModel: "gemma:2b",
      timeoutMs: 5000,
      temperature: 0.1,
    };

    it("grounds element via native Ollama chat API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              found: true,
              thought: "Target search icon found in header",
              point: [900, 80],
              confidence: 0.96,
            }),
          },
        }),
      } as Response);

      const provider = new OllamaProvider(ollamaConfig);
      const res = await provider.groundElement("Search", "base64image");

      expect(res.found).toBe(true);
      expect(res.point).toEqual({ x: 900, y: 80 });
      expect(res.confidence).toBe(0.96);
    });

    it("assertCondition evaluates screen state via native Ollama chat API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              passed: true,
              confidence: 0.98,
              explanation: "Profile icon active",
            }),
          },
        }),
      } as Response);

      const provider = new OllamaProvider(ollamaConfig);
      const res = await provider.assertCondition("Profile page active", "base64image");

      expect(res.passed).toBe(true);
      expect(res.confidence).toBe(0.98);
    });

    it("summarizeLogAnomalies returns clean fallback when logs array is empty", async () => {
      const provider = new OllamaProvider(ollamaConfig);
      const res = await provider.summarizeLogAnomalies([]);

      expect(res.hasFatalError).toBe(false);
      expect(res.summary).toBe("Empty log buffer.");
    });

    it("analyzeScreen processes visual screen analysis via Ollama chat API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              screenSummary: "Home feed with product list",
              scrollState: {
                isScrollable: true,
                position: "middle",
                canScrollUp: true,
                canScrollDown: true,
              },
              visibleKeyElements: [
                { label: "Checkout Button", type: "button", point: [500, 900] },
              ],
              hasActiveOverlay: true,
              confidence: 0.92,
            }),
          },
        }),
      } as Response);

      const provider = new OllamaProvider(ollamaConfig);
      const res = await provider.analyzeScreen("base64image", "Is checkout visible?", "elements");

      expect(res.screenSummary).toBe("Home feed with product list");
      expect(res.scrollState.position).toBe("middle");
      expect(res.hasActiveOverlay).toBe(true);
      expect(res.visibleKeyElements).toHaveLength(1);
    });
  });
});
