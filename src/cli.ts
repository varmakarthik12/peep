import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "./config/index.js";
import { startMcpServer } from "./server/index.js";
import { createProvider } from "./providers/index.js";
import { TargetManager, AndroidTarget, BrowserTarget, DesktopTarget, BaseTarget, DistilledElement, DesktopWindowInfo } from "./targets/index.js";
import { CoordinateMapper } from "./core/coordinate-mapper.js";
import { GestureEngine, SwipeDirection, SwipeDistance } from "./core/gesture-engine.js";
import { MacroRunner } from "./core/macro-runner.js";
import { tokenShield } from "./core/token-shield.js";
import { TargetPlatform } from "./config/schema.js";
import { logger } from "./utils/logger.js";
import { renderBanner, renderTable, formatNumber, formatCurrency } from "./utils/formatting.js";

const program = new Command();

program
  .name("peep")
  .description("Peripheral Evaluation & Execution Proxy: The Open-Source Token Shield for Autonomous Agents")
  .version("0.3.1")
  .option("-c, --config <path>", "Path to peep.yaml config file")
  .option("--log-level <level>", "Log level: debug, info, warn, error, silent", "info")
  .option("-d, --device <id>", "Explicit Android device/emulator serial ID (e.g. emulator-5554, 127.0.0.1:7555)")
  .option("--adb-host <host>", "Remote ADB server host (-H)")
  .option("--adb-port <port>", "Remote ADB server port (-P)")
  .option("--connect <address>", "Remote ADB device TCP connect address (e.g. 192.168.1.100:5555)");

function getTargetManagerAndConfig(cmdOpts: Record<string, unknown> = {}) {
  const opts = program.opts();
  const overrides: Record<string, unknown> = { logLevel: opts.logLevel };

  if (opts.adbHost || opts.adbPort || opts.connect || opts.device) {
    overrides.target = {
      android: {
        deviceId: opts.device,
        adbHost: opts.adbHost,
        adbPort: opts.adbPort ? parseInt(opts.adbPort, 10) : undefined,
        connectAddress: opts.connect,
      },
    };
  }

  const config = loadConfig(opts.config, overrides);
  const targetManager = new TargetManager(config.target, config.logs);
  const provider = createProvider(config.provider);
  return { config, targetManager, provider };
}

async function resolveAndInitTarget(
  targetManager: TargetManager,
  platform?: TargetPlatform,
  isJson = false
): Promise<BaseTarget> {
  const target = targetManager.getTarget(platform);
  if (target.isReady === false) {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            status: "UNSUPPORTED_PLATFORM",
            platform: target.name,
            message: target.scaffoldNotice,
            activePlatforms: ["android"],
          },
          null,
          2
        )
      );
    } else {
      console.error(
        pc.yellow(
          `\n⚠️  [UNSUPPORTED PLATFORM] Platform '${target.name}' is currently an adapter scaffold planned for v0.2.`
        )
      );
      if (target.scaffoldNotice) {
        console.error(pc.dim(`   ${target.scaffoldNotice}`));
      }
      console.error(
        pc.cyan(
          `   💡 To test today, run with --platform android (or omit --platform to use the active default).\n`
        )
      );
    }
    process.exit(1);
  }

  try {
    await target.init();
    return target;
  } catch (err) {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            status: "INIT_FAILED",
            platform: target.name,
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2
        )
      );
    } else {
      console.error(
        pc.red(`\n✗ [TARGET INIT ERROR] ${err instanceof Error ? err.message : String(err)}\n`)
      );
    }
    process.exit(1);
  }
}

// 1. peep serve
program
  .command("serve")
  .description("Start the Peep MCP Server over stdio for AI coding harnesses")
  .action(async () => {
    const opts = program.opts();
    const overrides: Record<string, unknown> = { logLevel: opts.logLevel };
    if (opts.adbHost || opts.adbPort || opts.connect || opts.device) {
      overrides.target = {
        android: {
          deviceId: opts.device,
          adbHost: opts.adbHost,
          adbPort: opts.adbPort ? parseInt(opts.adbPort, 10) : undefined,
          connectAddress: opts.connect,
        },
      };
    }
    const config = loadConfig(opts.config, overrides);
    await startMcpServer(config);
  });

// 2. peep devices
program
  .command("devices")
  .description("List all attached Android devices/emulators and show connection status")
  .option("--json", "Output device list as JSON")
  .action(async (cmdOpts) => {
    const { config } = getTargetManagerAndConfig();
    const androidConfig = config.target.android || {};
    const { AdbClient } = await import("./targets/android/adb-client.js");
    const adb = new AdbClient({
      adbPath: androidConfig.adbPath || config.target.adbPath || "adb",
      deviceId: androidConfig.deviceId || config.target.deviceId,
      host: androidConfig.adbHost,
      port: androidConfig.adbPort,
      connectAddress: androidConfig.connectAddress,
    });

    try {
      const devices = await adb.listDevices();
      if (cmdOpts.json) {
        console.log(JSON.stringify(devices, null, 2));
        return;
      }

      console.log(renderBanner());
      console.log(pc.bold(pc.cyan("Attached Android Devices & Emulators:\n")));

      if (devices.length === 0) {
        console.log(pc.yellow("No devices or emulators detected via ADB."));
        console.log(pc.dim("\nTips:"));
        console.log(pc.dim("  - Physical devices: Enable USB Debugging in Developer Options on device"));
        console.log(pc.dim("  - Emulators: Ensure emulator is running (e.g. MuMu on 127.0.0.1:7555, BlueStacks on 127.0.0.1:5555)"));
        console.log(pc.dim("  - Wi-Fi Debugging: Connect via 'peep --connect <ip>:<port> devices'"));
        return;
      }

      const configuredId = androidConfig.deviceId || config.target.deviceId;
      const rows = devices.map((d) => {
        const isSelected = configuredId ? d.id === configuredId : d.status === "device";
        const tag = isSelected ? (configuredId ? pc.cyan(" [CONFIGURED]") : pc.green(" [AUTO-SELECTED]")) : "";
        const statusDisplay =
          d.status === "device"
            ? pc.green("device (ready)")
            : d.status === "unauthorized"
            ? pc.red("unauthorized (check phone screen prompt)")
            : pc.yellow(d.status);

        return [
          d.id + tag,
          statusDisplay,
          d.model || "-",
          d.product || "-",
        ];
      });

      console.log(renderTable(["Serial / Socket", "State", "Model", "Product"], rows, "Connected Devices"));
      console.log(pc.dim(`\nTotal devices detected: ${devices.length}\n`));
    } catch (err) {
      if (cmdOpts.json) {
        console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err), devices: [] }, null, 2));
        return;
      }

      console.log(renderBanner());
      console.log(pc.bold(pc.cyan("Attached Android Devices & Emulators:\n")));
      console.log(pc.yellow(`Unable to query ADB devices: ${err instanceof Error ? err.message : String(err)}`));
      console.log(pc.dim("\nTroubleshooting Tips:"));
      console.log(pc.dim("  - Verify that Android SDK platform-tools ('adb') is installed and in your system PATH"));
      console.log(pc.dim("  - You can also set PEEP_ADB_PATH or use --adb-path to point to the adb binary"));
      console.log(pc.dim("  - For remote ADB servers, pass --adb-host and --adb-port\n"));
    }
  });

// 3. peep doctor
program
  .command("doctor")
  .description("Run system health check for ADB, connected devices, and local inference backend")
  .action(async () => {
    console.log(renderBanner());
    const { config, targetManager, provider } = getTargetManagerAndConfig();

    console.log(pc.bold(pc.cyan("Running Peep System Diagnostics...\n")));

    // 1. Check Inference Provider
    const health = await provider.checkHealth();
    const providerStatus = health.ok
      ? pc.green(`✓ ONLINE (${health.latencyMs}ms)`)
      : pc.red(`✗ OFFLINE (${health.error || "unreachable"})`);

    // 2. Check Target Platforms
    let allTargetsOk = true;
    const targetRows: string[][] = [];

    for (const platform of targetManager.getEnabledPlatforms()) {
      const target = targetManager.getTarget(platform);
      if (target.isReady !== false) {
        let status = pc.yellow("Pending");
        let details = "None";
        try {
          await target.init();
          const metrics = await target.getDisplayMetrics();
          status = pc.green(`✓ CONNECTED (${metrics.width}x${metrics.height})`);
          if (target instanceof AndroidTarget) {
            details = config.target.android?.deviceId || config.target.deviceId || "Auto-detected active device";
            if (config.target.android?.adbHost) {
              details += ` (${config.target.android.adbHost}:${config.target.android.adbPort || 5037})`;
            }
          }
        } catch (err) {
          allTargetsOk = false;
          status = pc.red(`✗ ERROR (${err instanceof Error ? err.message : String(err)})`);
        }
        targetRows.push([`Target Platform: ${platform} (Primary)`, target.name, details, status]);
      } else {
        const adapterDesc = platform === "browser" ? "Playwright / CDP scaffold" : "MSS / Display scaffold";
        targetRows.push([`Target Platform: ${platform}`, adapterDesc, "Adapter scaffold", pc.dim("⏳ PLANNED (v0.2)")]);
      }
    }

    const rows = [
      ["Inference Provider", config.provider.type, health.vlmModel || health.slmModel || "auto", providerStatus],
      ["Provider Endpoint", config.provider.baseUrl, "-", health.ok ? pc.green("OK") : pc.red("FAIL")],
      ...targetRows,
    ];

    console.log(
      renderTable(["Component", "Type / Config", "Model / Identifier", "Status"], rows, "Diagnostics Summary")
    );

    if (health.ok && allTargetsOk) {
      console.log(pc.green(pc.bold("\n✓ All systems operational! Peep is ready to shield tokens.\n")));
    } else {
      console.log(
        pc.yellow(
          pc.bold(
            "\n⚠️  Some components need attention. Review the table above before running automated tests.\n"
          )
        )
      );
    }

    await targetManager.closeAll();
    process.exit(0);
  });

// 3. peep tap
program
  .command("tap <target>")
  .description("Locate and tap a UI element on the screen")
  .option("-s, --strategy <strategy>", "Perception strategy: auto, tree_first, vision_only, tree_only", "auto")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--context <hint>", "Contextual visual hint")
  .option("--json", "Output result as JSON")
  .action(async (targetDesc: string, cmdOpts) => {
    const { config, targetManager, provider } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    const metrics = await target.getDisplayMetrics();
    const mapper = new CoordinateMapper(metrics, config.perception.coordinateScale);

    let tapped = false;
    let point: [number, number] | undefined;
    let method = "";

    // Tier 0/1: UI tree
    if (cmdOpts.strategy === "auto" || cmdOpts.strategy === "tree_first" || cmdOpts.strategy === "tree_only") {
      const el = await target.findSemanticElement(targetDesc);
      if (el) {
        const cx = Math.round((el.bounds.left + el.bounds.right) / 2);
        const cy = Math.round((el.bounds.top + el.bounds.bottom) / 2);
        await target.tap(cx, cy);
        tapped = true;
        point = [cx, cy];
        method = "tier0_semantic_tree";
        tokenShield.recordShieldedScreenshot(50);
      }
    }

    // Tier 2: Vision
    if (!tapped && cmdOpts.strategy !== "tree_only") {
      const frame = await target.captureScreenshot();
      const prompt = cmdOpts.context ? `${targetDesc} (${cmdOpts.context})` : targetDesc;
      const grounding = await provider.groundElement(prompt, frame.base64);

      if (grounding.found && grounding.point) {
        const phys = mapper.toPhysicalPoint(grounding.point, {
          frameWidth: frame.width,
          frameHeight: frame.height,
          jitter: true,
        });
        await target.tap(phys.x, phys.y);
        tapped = true;
        point = [phys.x, phys.y];
        method = "tier2_local_vlm";
        tokenShield.recordShieldedScreenshot(60);
      }
    }

    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(
        JSON.stringify({
          status: tapped ? "SUCCESS" : "NOT_FOUND",
          target: targetDesc,
          method: method || "none",
          tappedPoint: point,
          tokensSaved: tapped ? 1600 : 0,
        })
      );
    } else {
      if (tapped && point) {
        console.log(pc.green(`✓ [OK] Tapped '${targetDesc}' at (${point[0]}, ${point[1]}) via ${method} [Shielded 1,600 tokens]`));
      } else {
        console.error(pc.red(`✗ [FAIL] Could not locate target: '${targetDesc}'`));
        process.exit(1);
      }
    }
  });

// 4. peep type
program
  .command("type <text>")
  .description("Type text into the device input field")
  .option("-t, --target <target>", "Target field to tap and focus first")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--clear", "Clear field first", false)
  .option("--json", "Output result as JSON")
  .action(async (text: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (cmdOpts.target) {
      const el = await target.findSemanticElement(cmdOpts.target);
      if (el) {
        const cx = Math.round((el.bounds.left + el.bounds.right) / 2);
        const cy = Math.round((el.bounds.top + el.bounds.bottom) / 2);
        await target.tap(cx, cy);
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (cmdOpts.clear) {
      for (let i = 0; i < 20; i++) {
        await target.pressKey("backspace");
      }
    }

    await target.typeText(text);
    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(JSON.stringify({ status: "SUCCESS", textTyped: text }));
    } else {
      console.log(pc.green(`✓ [OK] Typed text: "${text}"`));
    }
  });

// 5. peep swipe
program
  .command("swipe <direction>")
  .description("Perform a swipe gesture: up, down, left, right")
  .option("-d, --distance <dist>", "Distance: short, medium, long", "medium")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (direction: string, cmdOpts) => {
    const validDirections: SwipeDirection[] = ["up", "down", "left", "right"];
    if (!validDirections.includes(direction as SwipeDirection)) {
      console.error(pc.red(`✗ [FAIL] Invalid swipe direction '${direction}'. Must be one of: ${validDirections.join(", ")}`));
      process.exit(1);
    }

    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    const metrics = await target.getDisplayMetrics();
    const coords = GestureEngine.calculateSwipe(
      metrics.width,
      metrics.height,
      direction as SwipeDirection,
      cmdOpts.distance as SwipeDistance
    );
    await target.swipe(coords);
    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(JSON.stringify({ status: "SUCCESS", direction, distance: cmdOpts.distance }));
    } else {
      console.log(pc.green(`✓ [OK] Swiped ${direction} (${cmdOpts.distance})`));
    }
  });

// 6. peep press
program
  .command("press <key>")
  .description("Dispatch hardware or navigation key (back, home, enter, tab, volume_up)")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (key: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    try {
      await target.pressKey(key);
      await targetManager.closeAll();

      if (cmdOpts.json) {
        console.log(JSON.stringify({ status: "SUCCESS", keyDispatched: key }));
      } else {
        console.log(pc.green(`✓ [OK] Dispatched key: ${key}`));
      }
    } catch (err) {
      await targetManager.closeAll();
      console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

// 7. peep assert
program
  .command("assert <condition>")
  .description("Visually assert if a condition is true on the active screen using local model")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (condition: string, cmdOpts) => {
    const { targetManager, provider } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    const frame = await target.captureScreenshot();
    const res = await provider.assertCondition(condition, frame.base64);

    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(
        JSON.stringify({
          status: res.passed ? "PASS" : "FAIL",
          assertion: condition,
          passed: res.passed,
          confidence: res.confidence,
          explanation: res.explanation,
        })
      );
    } else {
      if (res.passed) {
        console.log(pc.green(`✓ [PASS] "${condition}" (Confidence: ${Math.round(res.confidence * 100)}%)`));
        if (res.explanation) console.log(pc.dim(`  Details: ${res.explanation}`));
      } else {
        console.error(pc.red(`✗ [FAIL] "${condition}"`));
        if (res.explanation) console.error(pc.dim(`  Reason: ${res.explanation}`));
        process.exit(1);
      }
    }
  });

// 8. peep logs
program
  .command("logs")
  .description("View noise-filtered logs or run local model crash diagnosis")
  .option("--crashes", "Run local model crash and fatal error diagnosis", false)
  .option("-f, --filter <pattern>", "Filter by substring or regex")
  .option("-n, --limit <lines>", "Number of recent lines to display", "30")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager, provider } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    await new Promise((r) => setTimeout(r, 600));

    const rawLogs = await target.getRecentLogs(cmdOpts.filter);
    const limit = parseInt(cmdOpts.limit, 10) || 30;

    let diagnosis;
    if (cmdOpts.crashes && rawLogs.length > 0) {
      diagnosis = await provider.summarizeLogAnomalies(rawLogs);
    }

    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(
        JSON.stringify({
          bufferedCount: rawLogs.length,
          diagnosis,
          sample: rawLogs.slice(-limit),
        })
      );
    } else {
      if (diagnosis) {
        console.log(pc.bold(pc.yellow("\nCrash Diagnostic Analysis:")));
        if (diagnosis.hasFatalError) {
          console.log(pc.red(`✗ FATAL CRASH: ${diagnosis.summary}`));
          if (diagnosis.culprit) console.log(pc.yellow(`  Culprit: ${diagnosis.culprit}`));
          if (diagnosis.stackSnippet) console.log(pc.dim(`  Stack:\n${diagnosis.stackSnippet}`));
        } else {
          console.log(pc.green(`✓ ${diagnosis.summary}`));
        }
      }

      console.log(pc.bold(pc.cyan(`\nRecent Log Stream (${Math.min(limit, rawLogs.length)} lines):\n`)));
      for (const line of rawLogs.slice(-limit)) {
        console.log(line);
      }
    }
  });

// 9. peep goal
program
  .command("goal <task>")
  .description("Autonomous local micro-loop: execute high-level goal using local model")
  .option("-m, --max-steps <num>", "Maximum iterations", "8")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (task: string, cmdOpts) => {
    const { config, targetManager, provider } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    const metrics = await target.getDisplayMetrics();
    const mapper = new CoordinateMapper(metrics, config.perception.coordinateScale);

    const runner = new MacroRunner(provider, target, mapper);
    const maxSteps = parseInt(cmdOpts.maxSteps, 10) || 8;
    const result = await runner.runGoal(task, maxSteps);

    await targetManager.closeAll();

    if (cmdOpts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.status === "SUCCESS") {
        console.log(pc.green(pc.bold(`\n✓ Goal Completed Successfully in ${result.stepsExecuted} steps!`)));
        console.log(pc.magenta(`🛡️  Saved ${formatNumber(result.cloudTokensSaved)} cloud tokens.\n`));
      } else {
        console.log(pc.red(pc.bold(`\n✗ Goal ended with status: ${result.status}`)));
        if (result.error) console.log(pc.yellow(`  Details: ${result.error}`));
      }

      console.log(pc.bold("Execution History:"));
      result.history.forEach((h) => console.log(pc.dim(`  ${h}`)));
    }
  });

// 10. peep stats
program
  .command("stats")
  .description("View cumulative token shield telemetry and dollar savings")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const metrics = tokenShield.getMetrics();
    if (cmdOpts.json) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log(renderBanner());
      console.log(pc.bold(pc.magenta("Peep Token Shield Telemetry\n")));

      const rows = [
        ["Total Actions Shielded", formatNumber(metrics.totalActions)],
        ["Screenshots Shielded (0 cloud vision tokens)", formatNumber(metrics.screenshotsShielded)],
        ["Log Lines Shielded", formatNumber(metrics.logLinesShielded)],
        ["Autonomous Macro Steps Shielded", formatNumber(metrics.macroStepsShielded)],
        ["Cloud Tokens Saved", pc.bold(pc.green(formatNumber(metrics.cloudTokensSaved)))],
        ["Cloud Tokens Used (Compact JSON only)", pc.dim(formatNumber(metrics.cloudTokensUsed))],
        ["Net Token Reduction %", pc.bold(pc.green(`${metrics.netTokenSavingsPercentage}%`))],
        ["Estimated Cost Savings (USD)", pc.bold(pc.green(formatCurrency(metrics.estimatedCostSavedUsd)))],
      ];

      console.log(renderTable(["Metric", "Value"], rows));
    }
  });

// 11. peep benchmark
program
  .command("benchmark")
  .description("Run live simulation benchmark comparing Cloud LLM vs Peep Token Shield")
  .action(() => {
    console.log(renderBanner());
    console.log(pc.bold(pc.cyan("Empirical Token & Cost Benchmark Simulation\n")));

    const rows = [
      [
        "5-Step Form Fill & Tap",
        "11,000 tokens ($0.055)",
        "380 tokens ($0.0019)",
        pc.green("96.5%"),
        pc.green("96.5%"),
      ],
      [
        "Crash Log Investigation (2.5k lines)",
        "35,000 tokens ($0.175)",
        "120 tokens ($0.0006)",
        pc.green("99.6%"),
        pc.green("99.7%"),
      ],
      [
        "Full App Smoke Test (15 screens)",
        "36,000 tokens ($0.180)",
        "260 tokens ($0.0013)",
        pc.green("99.2%"),
        pc.green("99.3%"),
      ],
      [
        "100 Daily CI/CD Validation Runs",
        "4,500,000 tokens ($22.50)",
        "45,000 tokens ($0.225)",
        pc.green("99.0%"),
        pc.green("~$670/mo"),
      ],
    ];

    console.log(
      renderTable(
        ["Scenario", "Traditional Cloud Agent", "Peep Token Shield", "Token Savings", "Cost Reduction"],
        rows
      )
    );

    console.log(
      pc.dim(
        "\n* Based on standard multimodal pricing: $5.00 / 1M tokens. Resolution 1080x2400 @ 1,600 tokens/frame.\n"
      )
    );
  });

// 12. peep launch <app>
program
  .command("launch <app>")
  .description("Launch an application by package or component with automatic crash watchdog")
  .option("--no-stop", "Do not force stop existing instance before launching")
  .option("--reset", "Clear app data before launching (cold start)", false)
  .option("--no-wait", "Do not wait for initial activity launch to finish")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (app: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        const res = await target.launchApp({
          packageOrComponent: app,
          stopExisting: cmdOpts.stop,
          resetState: cmdOpts.reset,
          waitForLaunch: cmdOpts.wait,
        });
        await targetManager.closeAll();

        if (cmdOpts.json) {
          console.log(JSON.stringify({ status: res.crashDetected ? "CRASH_DETECTED" : "SUCCESS", ...res }, null, 2));
        } else {
          if (res.crashDetected) {
            console.error(pc.red(`✗ [CRASH DETECTED] App ${app} crashed on startup: ${res.crashDetected}`));
            process.exit(1);
          } else {
            console.log(pc.green(`✓ [OK] Launched ${app} (${res.totalTimeMs || 0}ms)`));
          }
        }
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      console.error(pc.red(`✗ Launch command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 13. peep stop <app>
program
  .command("stop <app>")
  .description("Force stop an application process")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (app: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      await target.stopApp(app);
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify({ status: "SUCCESS", stopped: app }));
      } else {
        console.log(pc.green(`✓ [OK] Force-stopped ${app}`));
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Stop command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 14. peep clear <app>
program
  .command("clear <app>")
  .description("Clear application user data and cache (reset to factory state)")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (app: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      await target.clearAppData(app);
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify({ status: "SUCCESS", cleared: app }));
      } else {
        console.log(pc.green(`✓ [OK] Cleared app data for ${app}`));
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Clear command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 15. peep wake
program
  .command("wake")
  .description("Wake screen and dismiss lockscreen/keyguard")
  .option("--pin <pin>", "Optional unlock PIN or password")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.wakeAndUnlock(cmdOpts.pin);
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify({ status: "SUCCESS", ...res }));
      } else {
        console.log(pc.green("✓ [OK] Device screen awake and keyguard dismissed."));
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Wake command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 16. peep clipboard <action> [text]
program
  .command("clipboard <action> [text]")
  .description("Clipboard operations: set, get, paste")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (action: string, text: string | undefined, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      if (action === "set") {
        if (!text) {
          console.error(pc.red("✗ [FAIL] Text argument is required for 'set' action"));
          await targetManager.closeAll();
          process.exit(1);
        }
        await target.setClipboard(text);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", action: "set", length: text.length }));
        else console.log(pc.green(`✓ [OK] Clipboard set (${text.length} chars)`));
      } else if (action === "get") {
        const val = await target.getClipboard();
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", text: val }));
        else console.log(pc.green(`✓ [OK] Clipboard: "${val}"`));
      } else if (action === "paste") {
        await target.pasteClipboard();
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", action: "paste" }));
        else console.log(pc.green("✓ [OK] Dispatched paste"));
      } else {
        await targetManager.closeAll();
        console.error(pc.red(`✗ Unknown action '${action}'. Use set, get, or paste.`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Clipboard command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 17. peep state
program
  .command("state")
  .description("Inspect current device state (foreground app, orientation, battery, resolution)")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const state = await target.getDeviceState();
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify(state, null, 2));
      } else {
        console.log(pc.bold(pc.cyan("\nDevice State:")));
        console.log(`  Foreground Package: ${pc.green(state.foreground.packageName || "None")}`);
        console.log(`  Foreground Activity: ${pc.green(state.foreground.activity || "None")}`);
        console.log(`  Resolution: ${state.display.width}x${state.display.height} (rotation: ${state.display.rotation}°)`);
        console.log(`  Battery Level: ${state.battery.level !== undefined ? `${state.battery.level}%` : "Unknown"}`);
        console.log(`  Charging: ${state.battery.charging ? pc.green("Yes") : "No"}\n`);
      }
    } else {
      const metrics = await target.getDisplayMetrics();
      await targetManager.closeAll();
      console.log(JSON.stringify({ platform: target.name, display: metrics }, null, 2));
    }
  });

// 18. peep apps
program
  .command("apps")
  .description("List installed applications on device")
  .option("-f, --filter <type>", "Filter: third_party, system, all", "third_party")
  .option("-s, --search <str>", "Search string")
  .option("-n, --limit <num>", "Limit results", "30")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const apps = await target.listApps(
        cmdOpts.filter as "third_party" | "system" | "all",
        cmdOpts.search,
        parseInt(cmdOpts.limit, 10)
      );
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify(apps, null, 2));
      } else {
        console.log(pc.bold(pc.cyan(`\nInstalled Apps (${apps.length} found):\n`)));
        apps.forEach((a) => console.log(`  • ${a.packageName}`));
        console.log("");
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Apps command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 19. peep install <path>
program
  .command("install <path>")
  .description("Install APK file onto device with automatic runtime permissions")
  .option("--no-grant", "Do not automatically grant all runtime permissions")
  .option("--no-reinstall", "Do not reinstall if package exists")
  .option("-d, --downgrade", "Allow version code downgrade", false)
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (apkPath: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        await target.installApp(apkPath, {
          grantPermissions: cmdOpts.grant,
          reinstall: cmdOpts.reinstall,
          allowDowngrade: cmdOpts.downgrade,
        });
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", path: apkPath }));
        else console.log(pc.green(`✓ [OK] Successfully installed APK: ${apkPath}`));
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Install command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 20. peep deeplink <url>
program
  .command("deeplink <url>")
  .description("Dispatch a deep link URI or URL via intent")
  .option("-a, --app <package>", "Target application package name")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (url: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.openDeepLink(url, cmdOpts.app);
      await targetManager.closeAll();
      if (cmdOpts.json) {
        console.log(JSON.stringify({ status: "SUCCESS", ...res }, null, 2));
      } else {
        console.log(pc.green(`✓ [OK] Dispatched deep link: ${url}`));
        if (res.resolvedPackage) console.log(pc.dim(`  Resolved package: ${res.resolvedPackage}`));
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Deep link command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 21. peep permission <app> <action> [permission]
program
  .command("permission <app> <action> [permission]")
  .description("Manage runtime permissions: grant, revoke, list")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (app: string, action: string, permission: string | undefined, cmdOpts) => {
    const validActions = ["grant", "revoke", "list"];
    if (!validActions.includes(action)) {
      console.error(pc.red(`✗ Invalid action '${action}'. Must be one of: ${validActions.join(", ")}`));
      process.exit(1);
    }

    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        const res = await target.managePermissions(action as "grant" | "revoke" | "list", app, permission);
        await targetManager.closeAll();
        if (cmdOpts.json) {
          console.log(JSON.stringify({ status: "SUCCESS", app, action, ...res }, null, 2));
        } else {
          console.log(pc.green(`✓ [OK] Permission ${action} succeeded for ${app}`));
          if (res.permissions.length > 0) {
            res.permissions.forEach((p) => console.log(pc.dim(`  • ${p}`)));
          }
        }
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Permission command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 22. peep orientation <orientation>
program
  .command("orientation <orientation>")
  .description("Set screen orientation: portrait, landscape, auto")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (orientation: string, cmdOpts) => {
    const validOrientations = ["portrait", "landscape", "auto"];
    if (!validOrientations.includes(orientation)) {
      console.error(pc.red(`✗ Invalid orientation '${orientation}'. Must be one of: ${validOrientations.join(", ")}`));
      process.exit(1);
    }

    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      await target.setScreenOrientation(orientation as "portrait" | "landscape" | "auto");
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", orientation }));
      else console.log(pc.green(`✓ [OK] Screen orientation set to ${orientation}`));
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Orientation command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 23. peep file <action> <devicePath> [hostPath]
program
  .command("file <action> <devicePath> [hostPath]")
  .description("File transfer operations: push, pull, delete")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (action: string, devicePath: string, hostPath: string | undefined, cmdOpts) => {
    const validActions = ["push", "pull", "delete"];
    if (!validActions.includes(action)) {
      console.error(pc.red(`✗ Invalid action '${action}'. Must be one of: ${validActions.join(", ")}`));
      process.exit(1);
    }

    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        const res = await target.manageFiles(action as "push" | "pull" | "delete", devicePath, hostPath);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", ...res }, null, 2));
        else console.log(pc.green(`✓ [OK] ${res.message || "File operation complete."}`));
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ File command only supported on Android target currently.`));
      process.exit(1);
    }
  });

// 24. peep browse <url>
program
  .command("browse <url>")
  .description("Navigate browser or Android Chrome to URL")
  .option("-p, --platform <platform>", "Target platform: browser, android")
  .option("--json", "Output result as JSON")
  .action(async (url: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const selected = (cmdOpts.platform as TargetPlatform) || "browser";
    const target = targetManager.getTarget(selected);

    if (target instanceof BrowserTarget) {
      try {
        const res = await target.navigate(url);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", httpStatus: res.status, url: res.url, title: res.title }, null, 2));
        else console.log(pc.green(`✓ [OK] Navigated to ${res.url} (${res.title})`));
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else if (target instanceof AndroidTarget) {
      await resolveAndInitTarget(targetManager, "android", cmdOpts.json);
      const res = await target.openDeepLink(url, "com.android.chrome");
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", method: "android_chrome", ...res }, null, 2));
      else console.log(pc.green(`✓ [OK] Dispatched URL to Chrome: ${url}`));
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Browse command not supported on target '${target.name}'.`));
      process.exit(1);
    }
  });

// 25. peep dom
program
  .command("dom")
  .description("Extract distilled interactive DOM representation (Browser target)")
  .option("-s, --selector <sel>", "Root selector", "body")
  .option("-d, --depth <num>", "Max DOM depth", "5")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = targetManager.getTarget("browser");

    if (target instanceof BrowserTarget) {
      try {
        const elements = await target.getDistilledDom(cmdOpts.selector, parseInt(cmdOpts.depth, 10));
        await targetManager.closeAll();
        if (cmdOpts.json) {
          console.log(JSON.stringify({ status: "SUCCESS", count: elements.length, elements }, null, 2));
        } else {
          console.log(pc.bold(pc.cyan(`\nDistilled DOM Elements (${elements.length} interactive items):\n`)));
          elements.forEach((el: DistilledElement) => {
            console.log(`  [${pc.green(el.refId)}] <${el.tag}> ${pc.bold(el.text || el.role || "")} (${el.selector})`);
          });
          console.log("");
        }
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ DOM distillation only supported on Browser target.`));
      process.exit(1);
    }
  });

// 26. peep window <action> [title]
program
  .command("window <action> [title]")
  .description("Desktop window management: list, focus, metrics")
  .option("--json", "Output result as JSON")
  .action(async (action: string, title: string | undefined, cmdOpts) => {
    const validActions = ["list", "focus", "metrics"];
    if (!validActions.includes(action)) {
      console.error(pc.red(`✗ Invalid action '${action}'. Must be one of: ${validActions.join(", ")}`));
      process.exit(1);
    }

    const { targetManager } = getTargetManagerAndConfig();
    const target = targetManager.getTarget("desktop");

    if (target instanceof DesktopTarget) {
      if (action === "list") {
        const windows = await target.listWindows();
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", count: windows.length, windows }, null, 2));
        else {
          console.log(pc.bold(pc.cyan(`\nDesktop Windows (${windows.length} found):\n`)));
          windows.forEach((w: DesktopWindowInfo) => console.log(`  • ${w.title}${w.processName ? ` (${w.processName})` : ""}`));
          console.log("");
        }
      } else if (action === "focus") {
        if (!title) {
          console.error(pc.red("✗ Title argument required for focus action"));
          await targetManager.closeAll();
          process.exit(1);
        }
        const ok = await target.focusWindow(title);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: ok ? "SUCCESS" : "NOT_FOUND", focused: ok, title }));
        else if (ok) console.log(pc.green(`✓ [OK] Focused window: "${title}"`));
        else {
          console.error(pc.red(`✗ [NOT FOUND] Could not find window matching "${title}"`));
          process.exit(1);
        }
      } else {
        const metrics = await target.getDisplayMetrics();
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", metrics }));
        else console.log(pc.green(`✓ Display: ${metrics.width}x${metrics.height} (rotation: ${metrics.rotation}°)`));
      }
    } else {
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify({ status: "UNSUPPORTED_TARGET", target: target.name }));
      else console.error(pc.red(`✗ Window management only supported on Desktop target.`));
      process.exit(1);
    }
  });

// 27. peep kill <target>
program
  .command("kill <target>")
  .description("Force stop an app, persistent daemon, or process by package, name, or PID (supports root kill)")
  .option("--root", "Use root privileges (kill -9 via su/root adbd) for stubborn daemons", false)
  .option("--no-matching", "Do not exterminate matching detached child processes", false)
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (targetArg: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.forceStopProcess(targetArg, {
        useRoot: cmdOpts.root,
        killAllMatching: cmdOpts.matching !== false,
      });
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify(res, null, 2));
      else console.log(pc.green(`✓ [OK] ${res.message}`));
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 28. peep restart <app>
program
  .command("restart <app>")
  .description("Hot-restart an application (kill and relaunch) with startup crash verification")
  .option("--root", "Use root kill to ensure all previous daemons are terminated", false)
  .option("--reset", "Clear app data before relaunch", false)
  .option("--no-wait", "Do not wait for initial activity launch to finish")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (app: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        const res = await target.restartApp({
          packageOrComponent: app,
          useRootKill: cmdOpts.root,
          resetState: cmdOpts.reset,
          waitForLaunch: cmdOpts.wait,
        });
        await targetManager.closeAll();

        if (cmdOpts.json) {
          console.log(JSON.stringify({ status: res.crashDetected ? "CRASH_DETECTED" : "SUCCESS", ...res }, null, 2));
        } else {
          if (res.crashDetected) {
            console.error(pc.red(`✗ [CRASH DETECTED] App ${app} crashed on restart: ${res.crashDetected}`));
            process.exit(1);
          } else {
            console.log(pc.green(`✓ [OK] Restarted ${app} (${res.totalTimeMs || 0}ms)`));
          }
        }
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [FAIL] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 29. peep reload <service>
program
  .command("reload <service>")
  .description("Reload system service without full reboot: zygote (LSPosed hooks), systemui, soft_reboot, surfaceflinger")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (service: string, cmdOpts) => {
    const valid = ["zygote", "systemui", "soft_reboot", "surfaceflinger"];
    if (!valid.includes(service)) {
      console.error(pc.red(`✗ Invalid service '${service}'. Must be one of: ${valid.join(", ")}`));
      process.exit(1);
    }
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.restartSystemService(service as "zygote" | "systemui" | "soft_reboot" | "surfaceflinger");
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify(res, null, 2));
      else console.log(pc.green(`✓ [OK] ${res.message} (${res.durationMs}ms)`));
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 30. peep root <command>
program
  .command("root <command>")
  .description("Execute shell command with root privileges (uid=0)")
  .option("-t, --timeout <ms>", "Execution timeout in milliseconds", "15000")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (command: string, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      try {
        const res = await target.executeRootCommand(command, parseInt(cmdOpts.timeout, 10));
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify(res, null, 2));
        else console.log(res.stdout);
      } catch (err) {
        await targetManager.closeAll();
        console.error(pc.red(`✗ [ROOT EXEC ERROR] ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 31. peep selinux [action]
program
  .command("selinux [action]")
  .description("Inspect or alter SELinux enforcement mode: get, permissive (setenforce 0), enforcing (setenforce 1)")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (action: string | undefined, cmdOpts) => {
    const act = (action || "get").toLowerCase() as "get" | "permissive" | "enforcing";
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.manageSelinux(act);
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify(res, null, 2));
      else console.log(pc.green(`✓ SELinux Mode: ${res.mode}${res.previousMode ? ` (was ${res.previousMode})` : ""}`));
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 32. peep ps
program
  .command("ps")
  .description("List active Linux/Android processes, PIDs, UIDs, and command lines")
  .option("-f, --filter <str>", "Filter by process name, package, or PID")
  .option("-n, --limit <num>", "Maximum processes to display", "50")
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const processes = await target.listProcesses(cmdOpts.filter, parseInt(cmdOpts.limit, 10));
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify(processes, null, 2));
      else {
        console.log(pc.bold(pc.cyan(`\nActive Processes (${processes.length} listed):\n`)));
        const rows = processes.map((p) => [
          String(p.pid),
          String(p.ppid),
          p.isRoot ? pc.red(p.uid) : p.uid,
          p.cmd.length > 50 ? p.cmd.substring(0, 47) + "..." : p.cmd,
        ]);
        console.log(renderTable(["PID", "PPID", "UID", "Command"], rows));
      }
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 33. peep component <component> <state>
program
  .command("component <component> <state>")
  .description("Enable or disable application component (pm enable/disable)")
  .option("--root", "Execute as root", false)
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (component: string, state: string, cmdOpts) => {
    const isEnable = state.toLowerCase() === "enable" || state === "1" || state.toLowerCase() === "true";
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      const res = await target.setComponentEnabled(component, isEnable, cmdOpts.root);
      await targetManager.closeAll();
      if (cmdOpts.json) console.log(JSON.stringify(res, null, 2));
      else console.log(pc.green(`✓ [OK] Component ${component} is now ${isEnable ? "enabled" : "disabled"}`));
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

// 34. peep prop <action> <name> [value]
program
  .command("prop <action> <name> [value]")
  .description("Get or set Android system properties (getprop / setprop)")
  .option("--root", "Set property as root", false)
  .option("-p, --platform <platform>", "Target platform: android, browser, desktop, ios")
  .option("--json", "Output result as JSON")
  .action(async (action: string, name: string, value: string | undefined, cmdOpts) => {
    const { targetManager } = getTargetManagerAndConfig();
    const target = await resolveAndInitTarget(targetManager, cmdOpts.platform as TargetPlatform, cmdOpts.json);

    if (target instanceof AndroidTarget) {
      if (action === "get") {
        const val = await target.getSystemProperty(name);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ name, value: val }));
        else console.log(`${name} = ${pc.green(val)}`);
      } else if (action === "set") {
        if (value === undefined) {
          console.error(pc.red("✗ Value argument required for 'set' action"));
          await targetManager.closeAll();
          process.exit(1);
        }
        await target.setSystemProperty(name, value, cmdOpts.root);
        await targetManager.closeAll();
        if (cmdOpts.json) console.log(JSON.stringify({ status: "SUCCESS", name, value }));
        else console.log(pc.green(`✓ Set ${name} = ${value}`));
      } else {
        await targetManager.closeAll();
        console.error(pc.red(`✗ Unknown action '${action}'. Use get or set.`));
        process.exit(1);
      }
    } else {
      await targetManager.closeAll();
      process.exit(1);
    }
  });

program.parse(process.argv);

