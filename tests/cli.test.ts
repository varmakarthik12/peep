import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(process.cwd(), "dist/cli.js");

describe("CLI End-to-End Execution", () => {
  it("prints help message with --help", async () => {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, "--help"]);

    expect(stdout).toContain("Usage: peep");
    expect(stdout).toContain("Peripheral Evaluation & Execution Proxy");
    expect(stdout).toContain("serve");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("benchmark");
    expect(stdout).toContain("stats");
    expect(stdout).toContain("tap");
    expect(stdout).toContain("swipe");
  });

  it("prints version with -V or --version", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "--version"]);
    expect(stdout.trim()).toBe("0.4.0");
  });

  it("executes benchmark command and renders token savings comparison table", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "benchmark"]);

    expect(stdout).toContain("Empirical Token & Cost Benchmark Simulation");
    expect(stdout).toContain("Traditional Cloud Agent");
    expect(stdout).toContain("Peep Token Shield");
    expect(stdout).toContain("Token Savings");
    expect(stdout).toContain("Cost Reduction");
    expect(stdout).toContain("5-Step Form Fill & Tap");
    expect(stdout).toContain("Crash Log Investigation");
    expect(stdout).toContain("96.5%");
    expect(stdout).toContain("99.6%");
  });

  it("executes stats command and displays session telemetry metrics", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "stats"]);

    expect(stdout).toContain("Peep Token Shield Telemetry");
    expect(stdout).toContain("Total Actions Shielded");
    expect(stdout).toContain("Screenshots Shielded");
    expect(stdout).toContain("Log Lines Shielded");
    expect(stdout).toContain("Cloud Tokens Saved");
    expect(stdout).toContain("Net Token Reduction %");
    expect(stdout).toContain("Estimated Cost Savings (USD)");
  });

  it("executes doctor command and reports system component status", async () => {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, "doctor"]);

    const combined = stdout + stderr;
    expect(combined).toContain("Running Peep System Diagnostics...");
    expect(combined).toContain("Diagnostics Summary");
    expect(combined).toContain("Inference Provider");
    expect(combined).toContain("Target Platform");
  });

  it("executes devices command and reports connected ADB devices or status", async () => {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, "devices"]);

    const combined = stdout + stderr;
    expect(combined).toContain("Attached Android Devices & Emulators");
  });

  it("executes devices command with --json flag", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "devices", "--json"]);

    const parsed = JSON.parse(stdout);
    expect(typeof parsed).toBe("object");
  });

  it("handles unsupported platform cleanly with user notice", async () => {
    try {
      await execFileAsync("node", [CLI_PATH, "tap", "--platform", "browser", "Button"]);
      expect.fail("Should have exited with code 1");
    } catch (err: any) {
      expect(err.code).toBe(1);
      const combined = (err.stdout || "") + (err.stderr || "");
      expect(combined).toContain("[UNSUPPORTED PLATFORM]");
      expect(combined).toContain("browser");
      expect(combined).not.toContain("Error:");
    }
  });

  it("outputs structured JSON on unsupported platform with --json", async () => {
    try {
      await execFileAsync("node", [CLI_PATH, "swipe", "up", "--platform", "desktop", "--json"]);
      expect.fail("Should have exited with code 1");
    } catch (err: any) {
      expect(err.code).toBe(1);
      const parsed = JSON.parse(err.stdout || err.stderr);
      expect(parsed.status).toBe("UNSUPPORTED_PLATFORM");
      expect(parsed.platform).toBe("desktop");
      expect(parsed.activePlatforms).toEqual(["android"]);
    }
  });

  it("registers all new v0.2.0 commands in --help", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "--help"]);

    expect(stdout).toContain("install");
    expect(stdout).toContain("deeplink");
    expect(stdout).toContain("permission");
    expect(stdout).toContain("orientation");
    expect(stdout).toContain("file");
    expect(stdout).toContain("browse");
    expect(stdout).toContain("dom");
    expect(stdout).toContain("window");
    expect(stdout).toContain("locate");
    expect(stdout).toContain("analyze");
  });

  it("prints help for browse and window commands", async () => {
    const { stdout: browseHelp } = await execFileAsync("node", [CLI_PATH, "browse", "--help"]);
    expect(browseHelp).toContain("Navigate browser or Android Chrome to URL");

    const { stdout: windowHelp } = await execFileAsync("node", [CLI_PATH, "window", "--help"]);
    expect(windowHelp).toContain("Desktop window management");
  });

  it("prints help for locate and analyze commands", async () => {
    const { stdout: locateHelp } = await execFileAsync("node", [CLI_PATH, "locate", "--help"]);
    expect(locateHelp).toContain("Locate an element visually or semantically without executing a tap");

    const { stdout: analyzeHelp } = await execFileAsync("node", [CLI_PATH, "analyze", "--help"]);
    expect(analyzeHelp).toContain("Visually analyze active screen layout, scroll state, and visible landmarks");
  });
});
