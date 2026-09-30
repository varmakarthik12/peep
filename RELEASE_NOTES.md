# 🛡️ Peep v0.2.0 — Target Expansion & OS Domination Release

We are excited to announce the release of **Peep v0.2.0 (Peripheral Evaluation & Execution Proxy)**: The Open-Source Token Shield for AI Coding Harnesses.

Peep offloads mobile visual perception, coordinate grounding, autonomous micro-loops, app lifecycle management, and noisy log analysis to local models (Ollama, vLLM, llama.cpp) and deterministic accessibility hierarchies—slashing cloud token consumption by **95% to 99.6%** across **Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

---

### 🚀 What's New in v0.2.0

- **15 New MCP Domain Tools (23 Total)**:
  - **App Lifecycle & State**: `peep_launch_app` (with auto launcher activity resolution and startup crash watchdog), `peep_stop_app`, `peep_clear_app_data`, `peep_install_app`, `peep_wake_and_unlock`, `peep_get_device_state`, `peep_set_screen_orientation`.
  - **OS Control & I/O**: `peep_manage_permissions`, `peep_clipboard`, `peep_open_deep_link`, `peep_manage_files`, `peep_list_apps`.
  - **Multi-Target Extensions**: `peep_browser_navigate`, `peep_browser_get_distilled_dom`, `peep_window_management`.
- **Strict Anti-Raw-ADB Shield**:
  - Enforced across all harness skills and rules to eliminate catastrophic context flooding (30k-75k tokens per logcat dump), vision token burns, silent crash blindness, and Windows CRLF binary corruption.
- **Simultaneous Multi-Target Architecture**:
  - Unified `TargetManager` enabling Android, Browser, Desktop, and iOS simultaneously with smart auto-routing and non-crashing scaffold failover.
- **Zero-Config Android Discovery & Port Disambiguation**:
  - One-plug auto-discovery of emulators (MuMu, BlueStacks, Nox, LDPlayer, WSA) and physical USB/Wi-Fi devices.
  - Clear architectural isolation between ADB Daemon Port (5037) and device sockets.
- **Turnkey Harness Integrations**:
  - One-line setup scripts and updated instruction files for Antigravity 2.0, Cursor, Claude Code CLI & Desktop, Windsurf Cascade, Cline & Roo Code (with complete 23-tool auto-approval), and GitHub Copilot.
- **12+ New Terminal CLI Subcommands**:
  - Direct shell commands for every MCP action (`peep launch`, `peep stop`, `peep clear`, `peep state`, `peep wake`, `peep clipboard`, `peep deeplink`, `peep apps`, `peep install`, etc.).

---

### 📦 Quickstart

```bash
# Verify environment and connected devices in 1 second
npx peep-mcp doctor

# Run empirical benchmark token savings simulation
npx peep-mcp benchmark
```

See [CHANGELOG.md](CHANGELOG.md) for full technical release notes, tool schemas, and empirical benchmarks.
