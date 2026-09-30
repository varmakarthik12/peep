# 🛡️ Peep v0.3.0 — Root & LSPosed Developer Suite Release

We are excited to announce the release of **Peep v0.3.0 (Peripheral Evaluation & Execution Proxy)**: The Open-Source Token Shield for AI Coding Harnesses.

Peep offloads mobile visual perception, coordinate grounding, autonomous micro-loops, app lifecycle management, and noisy log analysis to local models (Ollama, vLLM, llama.cpp) and deterministic accessibility hierarchies—slashing cloud token consumption by **95% to 99.6%** across **Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

---

### 🚀 What's New in v0.3.0

- **Root & LSPosed Developer Suite (8 New Tools, 31 MCP Tools Total)**:
  - `peep_force_stop_process`: Force kills stubborn apps, persistent daemons, and detached background services using PID or package matching (`am force-stop` + `pgrep -f` + root `kill -9`).
  - `peep_restart_app`: Atomic app restart exterminating background worker threads and verifying startup via the crash watchdog.
  - `peep_restart_system_service`: Instant reload of Android OS services (`zygote` for LSPosed hook updates in ~1.5s, `systemui` in ~1.2s, `soft_reboot` in ~2s) avoiding physical hardware reboots.
  - `peep_execute_root_command`: Root execution via `su -c` or root adbd with exit code verification.
  - `peep_manage_selinux`: Query or toggle SELinux (`permissive`/`enforcing`) for debugging AVC denial logs.
  - `peep_list_processes`: Detailed process enumeration with PID, PPID, user, CPU, memory metrics, and regex filtering.
  - `peep_toggle_component`: Dynamic enable/disable of Activities, Receivers, and Services with root override.
  - `peep_manage_system_properties`: Get and set Android system properties (`setprop`/`getprop`).
- **Enterprise Multi-OS CI Matrix Hardening**:
  - Full matrix test coverage across Node 20 & 22 on Ubuntu, macOS (arm64), and Windows runners (100% green).
  - Pinned TypeScript 5.9.3 to ensure zero-defect `tsup` declaration bundle generation (`rollup-plugin-dts`).
  - Migrated Zod schemas to `.prefault({})` and typed record structures for forward compatibility.
  - Resolved Windows headless runner display detection hangs with CI detection and child process execution timeouts.
  - Hardened GitHub Actions release workflow secret evaluation.
- **Previous v0.2.0 Features**:
  - Multi-target engine (Android, Browser, Desktop, iOS simultaneous support).
  - 15 core domain tools (`peep_launch_app`, `peep_stop_app`, `peep_install_app`, etc.).
  - Strict Anti-Raw-ADB Shield across all harness skills and rules.

---

### 📦 Quickstart

```bash
# Verify environment and connected devices in 1 second
npx peep-mcp doctor

# Run empirical benchmark token savings simulation
npx peep-mcp benchmark
```

See [CHANGELOG.md](CHANGELOG.md) for full technical release notes, tool schemas, and empirical benchmarks.
