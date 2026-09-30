import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTarget, AndroidTarget, BrowserTarget, DesktopTarget, TargetManager } from "../targets/index.js";
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

  const validateTarget = (
    platform?: TargetPlatform
  ): { target: BaseTarget; errorResponse?: { content: Array<{ type: "text"; text: string }> } } => {
    const target = getTarget(platform);
    if (target.isReady === false) {
      return {
        target,
        errorResponse: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "UNSUPPORTED_PLATFORM",
                  platform: target.name,
                  message:
                    target.scaffoldNotice ||
                    `Platform '${target.name}' is an architecture adapter scaffold planned for v0.2. In v0.1, the fully functional operational target is 'android' (ADB devices & emulators). For web apps, launch Chrome on the Android device and automate using platform: 'android'.`,
                  activePlatforms: ["android"],
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }
    return { target };
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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform (defaults to primary active target)"),
    },
    async ({ target: targetDesc, strategy, context, platform }) => {
      logger.info(`[MCP:tap] Target: "${targetDesc}", Strategy: ${strategy}, Platform: ${platform || "default"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      // Tier 0/1: Try semantic tree if strategy allows
      if (strategy === "auto" || strategy === "tree_first" || strategy === "tree_only") {
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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ text, target: targetDesc, clearFirst, platform }) => {
      logger.info(`[MCP:type] Text: "${text}", Target: ${targetDesc || "(active focus)"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (targetDesc) {
        const el = await target.findSemanticElement(targetDesc);
        if (el) {
          const cx = Math.round((el.bounds.left + el.bounds.right) / 2);
          const cy = Math.round((el.bounds.top + el.bounds.bottom) / 2);
          await target.tap(cx, cy);
          await new Promise((r) => setTimeout(r, 300));
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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ direction, distance, platform }) => {
      logger.info(`[MCP:swipe] Direction: ${direction}, Distance: ${distance}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ key, platform }) => {
      logger.info(`[MCP:press] Key: ${key}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ expectedState, platform }) => {
      logger.info(`[MCP:assert] Condition: "${expectedState}"`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ filterPattern, searchCrashes, limit, platform }) => {
      logger.info(`[MCP:logs] Filter: "${filterPattern || "*"}", CrashesOnly: ${searchCrashes}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

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
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ goal, maxSteps, platform }) => {
      logger.info(`[MCP:goal] Goal: "${goal}" (max ${maxSteps} steps)`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

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

  // 9. peep_launch_app
  server.tool(
    "peep_launch_app",
    "Launches an application by package name or component (e.g. 'com.android.chrome' or 'com.example/.MainActivity'). Automatically handles cold/warm start, checks for immediate crashes, and eliminates manual adb am start boilerplate.",
    {
      app: z.string().describe("Package name or component, e.g. 'com.android.chrome' or 'com.example/.MainActivity'"),
      stopExisting: z.boolean().default(true).describe("Force-stop existing process before launching (-S)"),
      resetState: z.boolean().default(false).describe("Clear app data/cache before launching (cold start)"),
      waitForLaunch: z.boolean().default(true).describe("Block until initial activity renders (-W)"),
      extras: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Intent extras key-value pairs"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ app, stopExisting = true, resetState = false, waitForLaunch = true, extras, platform }) => {
      logger.info(`[MCP:launch_app] App: ${app}, StopExisting: ${stopExisting}, Reset: ${resetState}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.launchApp({
          packageOrComponent: app,
          stopExisting,
          resetState,
          waitForLaunch,
          extras: extras as Record<string, string | number | boolean> | undefined,
        });
        const saved = tokenShield.recordShieldedLogs(40, 50);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: res.crashDetected ? "CRASH_DETECTED" : "SUCCESS",
                  app,
                  activity: res.activity,
                  launchState: res.launchState,
                  totalTimeMs: res.totalTimeMs,
                  waitTimeMs: res.waitTimeMs,
                  crashDetected: res.crashDetected,
                  cloudTokensSaved: saved,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 10. peep_install_app
  server.tool(
    "peep_install_app",
    "Installs an APK file onto the target device with automatic runtime permission granting (-g) and reinstall support (-r).",
    {
      path: z.string().describe("Local path to the APK file on host machine"),
      grantPermissions: z.boolean().default(true).describe("Grant all runtime permissions upon installation (-g)"),
      reinstall: z.boolean().default(true).describe("Reinstall existing application keeping data (-r)"),
      allowDowngrade: z.boolean().default(false).describe("Allow version code downgrade (-d)"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ path, grantPermissions = true, reinstall = true, allowDowngrade = false, platform }) => {
      logger.info(`[MCP:install_app] Path: ${path}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        await target.installApp(path, { grantPermissions, reinstall, allowDowngrade });
        const saved = tokenShield.recordShieldedLogs(30, 40);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "SUCCESS",
                  message: `Successfully installed APK: ${path}`,
                  cloudTokensSaved: saved,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 11. peep_stop_app
  server.tool(
    "peep_stop_app",
    "Terminates an application process cleanly or force-stops it.",
    {
      app: z.string().describe("Package name to stop (e.g. 'com.android.chrome')"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ app, platform }) => {
      logger.info(`[MCP:stop_app] App: ${app}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        await target.stopApp(app);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", message: `Force-stopped ${app}` }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 12. peep_clear_app_data
  server.tool(
    "peep_clear_app_data",
    "Clears all user data, databases, and cache for an application (resets to factory state).",
    {
      app: z.string().describe("Package name whose data will be cleared"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ app, platform }) => {
      logger.info(`[MCP:clear_app_data] App: ${app}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        await target.clearAppData(app);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", message: `Cleared app data for ${app}` }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 13. peep_wake_and_unlock
  server.tool(
    "peep_wake_and_unlock",
    "Wakes device screen if asleep, turns display on, and dismisses lockscreen/keyguard.",
    {
      pin: z.string().optional().describe("Optional lockscreen PIN or password"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ pin, platform }) => {
      logger.info(`[MCP:wake_and_unlock]`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.wakeAndUnlock(pin);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 14. peep_clipboard
  server.tool(
    "peep_clipboard",
    "Reliable clipboard operations (get, set, paste). Avoids character-by-character shell escaping issues with complex strings, newlines, and emojis.",
    {
      action: z.enum(["get", "set", "paste"]).describe("Clipboard action"),
      text: z.string().optional().describe("Text to set (required for action='set')"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ action, text, platform }) => {
      logger.info(`[MCP:clipboard] Action: ${action}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        if (action === "set") {
          if (text === undefined) throw new Error("text parameter required for clipboard action 'set'");
          await target.setClipboard(text);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", action: "set", length: text.length }, null, 2),
              },
            ],
          };
        } else if (action === "get") {
          const content = await target.getClipboard();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", action: "get", text: content }, null, 2),
              },
            ],
          };
        } else {
          await target.pasteClipboard();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", action: "paste" }, null, 2),
              },
            ],
          };
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 15. peep_get_device_state
  server.tool(
    "peep_get_device_state",
    "Returns current device status: foreground app/activity, screen metrics, orientation, battery percentage, and charging status.",
    {
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ platform }) => {
      logger.info(`[MCP:get_device_state]`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const state = await target.getDeviceState();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...state }, null, 2),
            },
          ],
        };
      }

      const metrics = await target.getDisplayMetrics();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "SUCCESS", platform: target.name, display: metrics }, null, 2),
          },
        ],
      };
    }
  );

  // 16. peep_open_deep_link
  server.tool(
    "peep_open_deep_link",
    "Dispatches a deep link or web URI via intent to test URL routing, app schemes, and universal links.",
    {
      url: z.string().describe("Deep link URI / URL (e.g. 'https://myapp.com/item/1' or 'myapp://pay')"),
      app: z.string().optional().describe("Optional package name to target"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ url, app, platform }) => {
      logger.info(`[MCP:open_deep_link] URL: ${url}, App: ${app || "auto"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.openDeepLink(url, app);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 17. peep_manage_permissions
  server.tool(
    "peep_manage_permissions",
    "Grants, revokes, or lists runtime Android permissions for an application (e.g. POST_NOTIFICATIONS, CAMERA, RECORD_AUDIO).",
    {
      app: z.string().describe("Target package name"),
      action: z.enum(["grant", "revoke", "list"]).describe("Permission operation"),
      permission: z.string().optional().describe("Permission name (e.g. 'POST_NOTIFICATIONS' or 'CAMERA')"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ app, action, permission, platform }) => {
      logger.info(`[MCP:manage_permissions] App: ${app}, Action: ${action}, Permission: ${permission || "*"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.managePermissions(action, app, permission);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", app, action, ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 18. peep_set_screen_orientation
  server.tool(
    "peep_set_screen_orientation",
    "Sets screen orientation to portrait, landscape, or auto-rotation mode.",
    {
      orientation: z.enum(["portrait", "landscape", "auto"]).describe("Screen orientation"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ orientation, platform }) => {
      logger.info(`[MCP:orientation] Setting orientation to: ${orientation}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        await target.setScreenOrientation(orientation);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", orientation }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 19. peep_manage_files
  server.tool(
    "peep_manage_files",
    "Transfers files between host and device or deletes files on device (push, pull, delete).",
    {
      action: z.enum(["push", "pull", "delete"]).describe("File operation"),
      devicePath: z.string().describe("Target file path on device"),
      hostPath: z.string().optional().describe("Source or destination path on host"),
      triggerMediaScan: z.boolean().default(true).describe("Trigger media scanner after file push"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ action, devicePath, hostPath, triggerMediaScan = true, platform }) => {
      logger.info(`[MCP:files] Action: ${action}, DevicePath: ${devicePath}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.manageFiles(action, devicePath, hostPath, triggerMediaScan);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 20. peep_list_apps
  server.tool(
    "peep_list_apps",
    "Lists installed packages on device with optional substring filtering.",
    {
      filter: z.enum(["third_party", "system", "all"]).default("third_party").describe("Filter package type"),
      search: z.string().optional().describe("Search substring"),
      limit: z.number().int().default(30).describe("Max packages to return"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ filter, search, limit, platform }) => {
      logger.info(`[MCP:list_apps] Filter: ${filter}, Search: ${search || "*"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const apps = await target.listApps(filter, search, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", count: apps.length, apps }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 21. peep_browser_navigate
  server.tool(
    "peep_browser_navigate",
    "Navigates the browser target (or Android Chrome browser) to a given URL with optional wait for DOM content loaded.",
    {
      url: z.string().describe("Web page URL to navigate to"),
      waitForLoad: z.boolean().default(true).describe("Wait for DOM content loaded"),
      timeoutMs: z.number().int().default(30000).describe("Navigation timeout in milliseconds"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).default("browser").optional().describe("Target platform"),
    },
    async ({ url, waitForLoad, timeoutMs, platform }) => {
      logger.info(`[MCP:browser_navigate] URL: ${url}`);
      const selected = platform || "browser";
      const target = getTarget(selected as TargetPlatform);

      if (target instanceof BrowserTarget) {
        const res = await target.navigate(url, waitForLoad, timeoutMs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", httpStatus: res.status, url: res.url, title: res.title }, null, 2),
            },
          ],
        };
      }

      if (target instanceof AndroidTarget) {
        const res = await target.openDeepLink(url, "com.android.chrome");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", method: "android_chrome_intent", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 22. peep_browser_get_distilled_dom
  server.tool(
    "peep_browser_get_distilled_dom",
    "Extracts a distilled accessibility/DOM representation containing only interactive landmarks and actionable elements with reference IDs, shielding 95%+ of raw DOM/HTML tokens.",
    {
      selector: z.string().default("body").describe("Root element selector"),
      maxDepth: z.number().int().default(5).describe("Maximum tree depth"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).default("browser").optional().describe("Target platform"),
    },
    async ({ selector, maxDepth, platform }) => {
      logger.info(`[MCP:distilled_dom] Selector: ${selector}`);
      const selected = platform || "browser";
      const target = getTarget(selected as TargetPlatform);

      if (target instanceof BrowserTarget) {
        const elements = await target.getDistilledDom(selector, maxDepth);
        const saved = tokenShield.recordShieldedScreenshot(50);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "SUCCESS",
                  count: elements.length,
                  elements,
                  cloudTokensSaved: saved,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 23. peep_window_management
  server.tool(
    "peep_window_management",
    "Desktop window control: list open application windows, focus a specific window by title, or inspect display bounds.",
    {
      action: z.enum(["list", "focus", "get_metrics"]).describe("Action to perform"),
      title: z.string().optional().describe("Window title filter for focus action"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).default("desktop").optional().describe("Target platform"),
    },
    async ({ action, title, platform }) => {
      logger.info(`[MCP:window_mgmt] Action: ${action}, Title: ${title || "*"}`);
      const selected = platform || "desktop";
      const target = getTarget(selected as TargetPlatform);

      if (target instanceof DesktopTarget) {
        if (action === "list") {
          const windows = await target.listWindows();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", count: windows.length, windows }, null, 2),
              },
            ],
          };
        } else if (action === "focus") {
          if (!title) throw new Error("title parameter required for focus action");
          const ok = await target.focusWindow(title);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: ok ? "SUCCESS" : "NOT_FOUND", focused: ok, title }, null, 2),
              },
            ],
          };
        } else {
          const metrics = await target.getDisplayMetrics();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", metrics }, null, 2),
              },
            ],
          };
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 24. peep_force_stop_process
  server.tool(
    "peep_force_stop_process",
    "Exterminates an application, stubborn background daemon, or process by package name, process name, or numeric PID. Supports root execution (kill -9 via su/root adbd) to eliminate persistent services, zygote-injected processes, and detached daemons that standard am force-stop cannot terminate.",
    {
      target: z.string().describe("Package name, process name pattern, or numeric PID to terminate"),
      useRoot: z.boolean().default(false).describe("Use root privileges (kill -9) to exterminate persistent services or root daemons"),
      killAllMatching: z.boolean().default(true).describe("Kill all detached child processes or daemons matching the process name"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ target: targetArg, useRoot = false, killAllMatching = true, platform }) => {
      logger.info(`[MCP:force_stop_process] Target: ${targetArg}, Root: ${useRoot}, KillMatching: ${killAllMatching}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.forceStopProcess(targetArg, { useRoot, killAllMatching });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 25. peep_restart_app
  server.tool(
    "peep_restart_app",
    "Hot-restarts an application in one operation (force-stops, optionally with root kill, and relaunches). Ideal for LSPosed, Xposed, Frida, and rooted app development loops to test newly applied hooks or builds, verifying launch stability via the crash watchdog.",
    {
      app: z.string().describe("Package name or component, e.g. 'com.example.app' or 'com.example.app/.MainActivity'"),
      useRootKill: z.boolean().default(false).describe("Use root kill before relaunch to ensure all detached native workers and hooks are completely dead"),
      resetState: z.boolean().default(false).describe("Wipe app data/cache before relaunching (cold start)"),
      waitForLaunch: z.boolean().default(true).describe("Block until initial activity renders"),
      extras: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Intent extras key-value pairs"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ app, useRootKill = false, resetState = false, waitForLaunch = true, extras, platform }) => {
      logger.info(`[MCP:restart_app] App: ${app}, RootKill: ${useRootKill}, Reset: ${resetState}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.restartApp({
          packageOrComponent: app,
          useRootKill,
          resetState,
          waitForLaunch,
          extras: extras as Record<string, string | number | boolean> | undefined,
        });
        const saved = tokenShield.recordShieldedLogs(40, 50);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: res.crashDetected ? "CRASH_DETECTED" : "SUCCESS",
                  app,
                  activity: res.activity,
                  launchState: res.launchState,
                  totalTimeMs: res.totalTimeMs,
                  killedPids: res.killedPids,
                  crashDetected: res.crashDetected,
                  cloudTokensSaved: saved,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 26. peep_restart_system_service
  server.tool(
    "peep_restart_system_service",
    "Restarts core Android system services without performing a slow full device reboot. 'zygote' instantly reloads all 32/64-bit Zygote framework hooks and LSPosed modules (~1.5s). 'systemui' reloads status bar and UI overlays (~1s). 'soft_reboot' restarts the Android framework (~2s).",
    {
      service: z.enum(["zygote", "systemui", "soft_reboot", "surfaceflinger"]).describe("System service to reload: 'zygote' (LSPosed framework hook reload), 'systemui' (Status bar/QuickSettings), 'soft_reboot' (framework restart), 'surfaceflinger' (compositor restart)"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ service, platform }) => {
      logger.info(`[MCP:restart_system_service] Service: ${service}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.restartSystemService(service);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 27. peep_execute_root_command
  server.tool(
    "peep_execute_root_command",
    "Executes a privileged shell command on the device with root access (uid=0) via root adbd or 'su -c'. Allows modifying protected files, inspecting /data/adb/ or /data/data/, and running system debugging tools.",
    {
      command: z.string().describe("Privileged command string to execute as root"),
      timeoutMs: z.number().int().default(15000).describe("Timeout in milliseconds"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ command, timeoutMs = 15000, platform }) => {
      logger.info(`[MCP:root_command] Command: ${command}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.executeRootCommand(command, timeoutMs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: res.success ? "SUCCESS" : "ERROR",
                  command,
                  stdout: res.stdout,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 28. peep_manage_selinux
  server.tool(
    "peep_manage_selinux",
    "Inspects or alters SELinux enforcement mode ('get', 'permissive', 'enforcing'). Crucial when diagnosing avc: denied policy denials during rooted app, Magisk, or LSPosed module development.",
    {
      action: z.enum(["get", "permissive", "enforcing"]).describe("SELinux action: 'get' queries mode, 'permissive' sets setenforce 0, 'enforcing' sets setenforce 1"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ action, platform }) => {
      logger.info(`[MCP:selinux] Action: ${action}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.manageSelinux(action);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", action, ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 29. peep_list_processes
  server.tool(
    "peep_list_processes",
    "Lists active Linux/Android processes, their PIDs, PPIDs, UIDs, and command lines. Identifies running daemons, Magisk/LSPosed workers, and background child processes.",
    {
      filter: z.string().optional().describe("Optional substring search to filter process command line or name"),
      limit: z.number().int().default(50).describe("Maximum number of processes to return"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ filter, limit = 50, platform }) => {
      logger.info(`[MCP:list_processes] Filter: ${filter || "*"}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const processes = await target.listProcesses(filter, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", count: processes.length, processes }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 30. peep_set_component_enabled
  server.tool(
    "peep_set_component_enabled",
    "Enables or disables an application component (Activity, Service, Receiver, Provider) using PackageManager (pm enable/disable). Essential for testing hook toggles, component suppression, or state persistence in rooted apps.",
    {
      component: z.string().describe("Component specification (e.g. 'com.example.app/.services.SyncService')"),
      enabled: z.boolean().describe("Whether to enable (true) or disable (false) the component"),
      useRoot: z.boolean().default(false).describe("Execute command as root if target app has protected permissions"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ component, enabled, useRoot = false, platform }) => {
      logger.info(`[MCP:component_state] Component: ${component}, Enabled: ${enabled}, Root: ${useRoot}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        const res = await target.setComponentEnabled(component, enabled, useRoot);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "SUCCESS", ...res }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );

  // 31. peep_system_properties
  server.tool(
    "peep_system_properties",
    "Reads or writes Android system properties (getprop / setprop). Useful for inspecting build properties, LSPosed debug flags, or setting system configuration values.",
    {
      action: z.enum(["get", "set"]).describe("Action: 'get' to read, 'set' to write"),
      name: z.string().describe("Property name (e.g. 'persist.sys.locale' or 'debug.stagefright.ccodec')"),
      value: z.string().optional().describe("Property value (required if action='set')"),
      useRoot: z.boolean().default(false).describe("Set property as root (required for protected or persist.* properties)"),
      platform: z.enum(["android", "browser", "desktop", "ios"]).optional().describe("Target platform"),
    },
    async ({ action, name, value, useRoot = false, platform }) => {
      logger.info(`[MCP:sys_prop] Action: ${action}, Name: ${name}`);
      const { target, errorResponse } = validateTarget(platform as TargetPlatform);
      if (errorResponse) return errorResponse;

      if (target instanceof AndroidTarget) {
        if (action === "get") {
          const val = await target.getSystemProperty(name);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", action: "get", name, value: val }, null, 2),
              },
            ],
          };
        } else {
          if (value === undefined) throw new Error("value parameter is required for action='set'");
          await target.setSystemProperty(name, value, useRoot);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "SUCCESS", action: "set", name, value }, null, 2),
              },
            ],
          };
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }) }],
      };
    }
  );
}
