import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTarget, AndroidTarget } from "../targets/index.js";
import { BaseInferenceProvider } from "../providers/index.js";
import { CoordinateMapper } from "../core/coordinate-mapper.js";
import { GestureEngine } from "../core/gesture-engine.js";
import { MacroRunner } from "../core/macro-runner.js";
import { tokenShield } from "../core/token-shield.js";
import { logger } from "../utils/logger.js";

export function registerTools(
  server: McpServer,
  target: BaseTarget,
  provider: BaseInferenceProvider,
  mapper: CoordinateMapper
): void {
  const macroRunner = new MacroRunner(provider, target, mapper);

  // 1. peep_find_and_tap
  server.tool(
    "peep_find_and_tap",
    "Locates a visual element on the device screen (via Tier 0 accessibility tree or Tier 2 local VLM) and executes a physical tap. Never returns raw screenshots to the cloud harness, saving 1600+ vision tokens.",
    {
      target: z.string().describe("Semantic description or text of the element to tap (e.g. 'Submit button', 'Settings', 'Search input')"),
      strategy: z
        .enum(["auto", "tree_first", "vision_only", "tree_only"])
        .default("auto")
        .describe("Perception strategy: 'auto' tries UI tree first then falls back to local VLM vision"),
      context: z.string().optional().describe("Optional contextual hint (e.g. 'in the top right navigation bar')"),
    },
    async ({ target: targetDesc, strategy, context }) => {
      logger.info(`[MCP:tap] Target: "${targetDesc}", Strategy: ${strategy}`);

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

      // Tier 2: Local VLM visual grounding
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
    },
    async ({ text, target: targetDesc, clearFirst }) => {
      logger.info(`[MCP:type] Text: "${text}", Target: ${targetDesc || "(active focus)"}`);

      if (targetDesc) {
        // Tap target to focus
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
        // Select all & backspace if needed
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
    },
    async ({ direction, distance }) => {
      logger.info(`[MCP:swipe] Direction: ${direction}, Distance: ${distance}`);
      const metrics = await target.getDisplayMetrics();
      const coords = GestureEngine.calculateSwipe(
        metrics.width,
        metrics.height,
        direction,
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
    },
    async ({ key }) => {
      logger.info(`[MCP:press] Key: ${key}`);
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
    "Uses the local VLM to visually evaluate whether an expected condition is TRUE or FALSE on screen, returning confidence and explanation without cloud token burn.",
    {
      expectedState: z.string().describe("Expected condition to verify (e.g. 'Order confirmation popup is visible', 'Error toast is shown')"),
    },
    async ({ expectedState }) => {
      logger.info(`[MCP:assert] Condition: "${expectedState}"`);
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
    "Retrieves background buffered logs, strips framework noise, and runs local SLM anomaly detection to produce a 3-line diagnostic instead of flooding context with 30,000+ log tokens.",
    {
      filterPattern: z.string().optional().describe("Optional substring or regex filter"),
      searchCrashes: z.boolean().default(true).describe("Whether to run local SLM crash diagnosis"),
      limit: z.number().int().default(100).describe("Max lines to return"),
    },
    async ({ filterPattern, searchCrashes, limit }) => {
      logger.info(`[MCP:logs] Filter: "${filterPattern || "*"}", CrashesOnly: ${searchCrashes}`);
      const rawLogs = await target.getRecentLogs(filterPattern);
      const linesCount = rawLogs.length;

      let diagnosis;
      if (searchCrashes && linesCount > 0) {
        diagnosis = await provider.summarizeLogAnomalies(rawLogs);
      }

      const saved = tokenShield.recordShieldedLogs(linesCount, 60);

      const recentSample = rawLogs.slice(-Math.min(limit, 20));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "SUCCESS",
                rawLinesBuffered: linesCount,
                bufferedCount: linesCount,
                diagnosis: diagnosis || {
                  hasFatalError: false,
                  summary: "No crash search requested.",
                },
                recentSample,
                sample: recentSample,
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
    "Autonomous Local Micro-Loop: Hands a multi-step task to the local VLM to execute up to maxSteps actions locally. Shields all intermediate screen frames and only reports the final outcome.",
    {
      goal: z.string().describe("High-level task (e.g. 'Dismiss permission dialog and tap on Settings')"),
      maxSteps: z.number().int().default(8).describe("Maximum allowed perception-action iterations"),
    },
    async ({ goal, maxSteps }) => {
      logger.info(`[MCP:goal] Goal: "${goal}" (max ${maxSteps} steps)`);
      const result = await macroRunner.runGoal(goal, maxSteps);

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
