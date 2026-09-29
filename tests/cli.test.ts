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
    expect(stdout.trim()).toBe("0.1.0");
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
});
