import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTarget, AndroidTarget, TargetManager } from "../targets/index.js";
import { BaseInferenceProvider } from "../providers/index.js";
import { CoordinateMapper } from "../core/coordinate-mapper.js";
import { GestureEngine, SwipeDirection } from "../core/gesture-engine.js";
import { MacroRunner } from "../core/macro-runner.js";
import { tokenShield } from "../core/token-shield.js";
import { TargetPlatform } from "../config/schema.js";
import { logger } from "../utils/logger.js";

export function registerTools(
  server: McpServer,
  targetOrManager: BaseTarget | TargetManager,
  provider: BaseInferenceProvider,
  mapper: CoordinateMapper
): void {
  const getTarget = (platform?: TargetPlatform): BaseTarget => {
    if (targetOrManager instanceof TargetManager) {
      return targetOrManager.getTarget(platform);
    }
    return targetOrManager;
  };

  // 1. peep_find_and_tap
  server.tool(
    "peep_find_and_tap",
    "Locates a visual element on the device/platform screen (via Tier 0 accessibility tree or Tier 2 local vision model) and executes a physical tap. Shields raw screenshots from cloud context, saving 1600+ vision tokens.",
    {
      target: z.string().describe("Semantic description or text of the element to tap (e.g. 'Submit button', 'Settings', 'Search input')"),
      strategy: z
        .enum(["auto", "tree_first", "vision_only", "tree_only"])
        .default("auto")
        .describe("Perception strategy: 'auto' tries UI tree first then falls back to local vision model"),
      context: z.string().optional().describe("Optional contextual hint (e.g. 'in the top right navigation bar')"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform (defaults to primary active target)"),
    },
    async ({ target: targetDesc, strategy, context, platform }) => {
      logger.info(`[MCP:tap] Target: "${targetDesc}", Strategy: ${strategy}, Platform: ${platform || "default"}`);
      const target = getTarget(platform as TargetPlatform);

      // Tier 0/1: Try semantic tree if strategy allows
      if (strategy === "auto" || strategy === "tree_first" || strategy === "tree_only") {
        if (target instanceof AndroidTarget) {
          const el = await target.findSemanticElement(targetDesc);
          if (el) {
            const centerX = Math.round((el.bounds.left + el.bounds.right) / 2);
            const centerY = Math.round((el.bounds.top + el.bounds.bottom) / 2);
            await target.tap(centerX, centerY);

            const saved = tokenShield.recordShieldedScreenshot(50);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      status: "SUCCESS",
                      method: "tier0_semantic_tree",
                      tappedPoint: [centerX, centerY],
                      matchedElement: {
                        text: el.text,
                        id: el.id,
                        contentDescription: el.contentDescription,
                      },
                      cloudTokensSaved: saved,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        if (strategy === "tree_only") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "NOT_FOUND",
                  method: "tree_only",
                  message: `Element '${targetDesc}' not found in UI tree hierarchy.`,
                }),
              },
            ],
          };
        }
      }

      // Tier 2: Local vision model visual grounding
      const frame = await target.captureScreenshot();
      const prompt = context ? `${targetDesc} (${context})` : targetDesc;
      const grounding = await provider.groundElement(prompt, frame.base64);

      if (!grounding.found || !grounding.point) {
        tokenShield.recordShieldedScreenshot(50);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "NOT_FOUND",
                method: "tier2_local_vlm",
                message: `Local vision model could not visually locate: "${targetDesc}".`,
                thought: grounding.thought,
              }),
            },
          ],
        };
      }

      // Map normalized [0-1000] coordinates to physical device resolution
      const phys = mapper.toPhysicalPoint(grounding.point, {
        frameWidth: frame.width,
        frameHeight: frame.height,
        jitter: true,
      });

      await target.tap(phys.x, phys.y);
      const saved = tokenShield.recordShieldedScreenshot(60);

      // Check watchdog
      const watchdog = await target.checkCrashWatchdog();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                method: "tier2_local_vlm",
                tappedPoint: [phys.x, phys.y],
                confidence: grounding.confidence,
                thought: grounding.thought,
                crashDetected: watchdog.hasCrashed ? watchdog.reason : undefined,
                cloudTokensSaved: saved,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. peep_type_text
  server.tool(
    "peep_type_text",
    "Types text into an active input field. If target is provided, focuses it first.",
    {
      text: z.string().describe("Text string to type"),
      target: z.string().optional().describe("Optional target field to tap and focus before typing"),
      clearFirst: z.boolean().default(false).describe("Whether to clear the field first"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ text, target: targetDesc, clearFirst, platform }) => {
      logger.info(`[MCP:type] Text: "${text}", Target: ${targetDesc || "(active focus)"}`);
      const target = getTarget(platform as TargetPlatform);

      if (targetDesc) {
        if (target instanceof AndroidTarget) {
          const el = await target.findSemanticElement(targetDesc);
          if (el) {
            const cx = Math.round((el.bounds.left + el.bounds.right) / 2);
            const cy = Math.round((el.bounds.top + el.bounds.bottom) / 2);
            await target.tap(cx, cy);
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      if (clearFirst) {
        for (let i = 0; i < 25; i++) {
          await target.pressKey("backspace");
        }
      }

      await target.typeText(text);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "SUCCESS",
              textTyped: text,
              focusedTarget: targetDesc || undefined,
            }),
          },
        ],
      };
    }
  );

  // 3. peep_swipe
  server.tool(
    "peep_swipe",
    "Performs a smooth directional swipe gesture on the device screen.",
    {
      direction: z.enum(["up", "down", "left", "right"]).describe("Direction of swipe"),
      distance: z.enum(["short", "medium", "long"]).default("medium").describe("Distance of swipe"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ direction, distance, platform }) => {
      logger.info(`[MCP:swipe] Direction: ${direction}, Distance: ${distance}`);
      const target = getTarget(platform as TargetPlatform);
      const metrics = await target.getDisplayMetrics();
      const coords = GestureEngine.calculateSwipe(
        metrics.width,
        metrics.height,
        direction as SwipeDirection,
        distance
      );
      await target.swipe(coords);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "SUCCESS",
              direction,
              distance,
              start: [coords.startX, coords.startY],
              end: [coords.endX, coords.endY],
            }),
          },
        ],
      };
    }
  );

  // 4. peep_press_key
  server.tool(
    "peep_press_key",
    "Dispatches a hardware or navigation key event (e.g. 'back', 'home', 'enter', 'tab').",
    {
      key: z.string().describe("Key name: 'back', 'home', 'enter', 'tab', 'volume_up', 'volume_down'"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ key, platform }) => {
      logger.info(`[MCP:press] Key: ${key}`);
      const target = getTarget(platform as TargetPlatform);
      await target.pressKey(key);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "SUCCESS", keyDispatched: key }),
          },
        ],
      };
    }
  );

  // 5. peep_assert_screen_state
  server.tool(
    "peep_assert_screen_state",
    "Uses local vision model to visually evaluate whether an expected condition is TRUE or FALSE on screen, returning confidence and explanation without cloud token burn.",
    {
      expectedState: z.string().describe("Expected condition to verify (e.g. 'Order confirmation popup is visible', 'Error toast is shown')"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ expectedState, platform }) => {
      logger.info(`[MCP:assert] Condition: "${expectedState}"`);
      const target = getTarget(platform as TargetPlatform);
      const frame = await target.captureScreenshot();
      const res = await provider.assertCondition(expectedState, frame.base64);
      const saved = tokenShield.recordShieldedScreenshot(60);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: res.passed ? "PASS" : "FAIL",
                passed: res.passed,
                assertionPassed: res.passed,
                confidence: res.confidence,
                explanation: res.explanation,
                cloudTokensSaved: saved,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 6. peep_tail_and_filter_logs
  server.tool(
    "peep_tail_and_filter_logs",
    "Retrieves background buffered logs, strips framework noise, and runs local model crash diagnosis to produce a 3-line diagnostic instead of flooding context with 30,000+ log tokens.",
    {
      filterPattern: z.string().optional().describe("Optional substring or regex filter"),
      searchCrashes: z.boolean().default(true).describe("Whether to run local model crash diagnosis"),
      limit: z.number().int().default(100).describe("Max lines to return"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ filterPattern, searchCrashes, limit, platform }) => {
      logger.info(`[MCP:logs] Filter: "${filterPattern || "*"}", CrashesOnly: ${searchCrashes}`);
      const target = getTarget(platform as TargetPlatform);
      const rawLogs = await target.getRecentLogs(filterPattern);
      const linesCount = rawLogs.length;

      let diagnosis;
      if (searchCrashes && linesCount > 0) {
        diagnosis = await provider.summarizeLogAnomalies(rawLogs);
      }

      const saved = tokenShield.recordShieldedLogs(linesCount, 60);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                bufferedCount: linesCount,
                rawLinesBuffered: linesCount,
                diagnosis: diagnosis || {
                  hasFatalError: false,
                  summary: "No crash search requested.",
                },
                sample: rawLogs.slice(-Math.min(limit, 20)),
                recentSample: rawLogs.slice(-Math.min(limit, 20)),
                cloudTokensSaved: saved,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. peep_execute_goal
  server.tool(
    "peep_execute_goal",
    "Autonomous Local Micro-Loop: Hands a multi-step task to the local model to execute up to maxSteps actions locally. Shields all intermediate screen frames and only reports the final outcome.",
    {
      goal: z.string().describe("High-level task (e.g. 'Dismiss permission dialog and tap on Settings')"),
      maxSteps: z.number().int().default(8).describe("Maximum allowed perception-action iterations"),
      platform: z.enum(["android", "browser", "desktop"]).optional().describe("Target platform"),
    },
    async ({ goal, maxSteps, platform }) => {
      logger.info(`[MCP:goal] Goal: "${goal}" (max ${maxSteps} steps)`);
      const target = getTarget(platform as TargetPlatform);
      const runner = new MacroRunner(provider, target, mapper);
      const result = await runner.runGoal(goal, maxSteps);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // 8. peep_get_telemetry
  server.tool(
    "peep_get_telemetry",
    "Returns cumulative session statistics on shielded vision frames, log lines, total cloud tokens saved, and estimated USD cost savings.",
    {},
    async () => {
      const metrics = tokenShield.getMetrics();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    }
  );
}
