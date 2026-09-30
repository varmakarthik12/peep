# 🛡️ Peep v0.4.0 — Pure Visual Analysis & Scroll Perception Suite
 
We are excited to announce the release of **Peep v0.4.0 (Peripheral Evaluation & Execution Proxy)**: The Open-Source Token Shield for AI Coding Harnesses.

Peep offloads mobile visual perception, coordinate grounding, autonomous micro-loops, app lifecycle management, and noisy log analysis to local models (Ollama, vLLM, llama.cpp) and deterministic accessibility hierarchies—slashing cloud token consumption by **95% to 99.6%** across **Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

---

### 🚀 What's New in v0.4.0

- **Pure Visual Analysis Suite (2 New Tools, 33 MCP Tools Total)**:
  - `peep_locate_element`: Non-mutating UI element locator leveraging Tier 0 accessibility hierarchy or Tier 2 local vision. Returns element existence, physical bounding boxes, center click coordinates, and confidence scores without tapping or altering screen state.
  - `peep_analyze_screen`: Non-destructive screen layout and scroll state inspection. Uses local VLM or accessibility tree fallback to deliver high-level screen summaries, scroll position (`top`, `middle`, `bottom`), vertical scrollability indicators (`isScrollable`, `canScrollUp`, `canScrollDown`, `scrollbarVisible`), active modal/dialog overlays, and major UI landmarks.
- **Scroll State Detection**:
  - Deterministic Tier 0 scrollability extraction from Android's `uiautomator` tree (`@_scrollable`).
  - Structured vision provider analysis for scroll position and landmark extraction.
- **CLI Commands**:
  - `peep locate <target>`: Rapidly locate UI element coordinates from the command line.
  - `peep analyze [prompt]`: Inspect screen composition and scroll posture with optional prompt focus.
- **Root & LSPosed Developer Suite (from v0.3.0)**:
  - `peep_force_stop_process`, `peep_restart_app`, `peep_restart_system_service`, `peep_execute_root_command`, `peep_manage_selinux`, `peep_list_processes`, `peep_toggle_component`, `peep_manage_system_properties`.

---

### 📦 Quickstart

```bash
# Verify environment and connected devices in 1 second
npx peep-mcp doctor

# Run empirical benchmark token savings simulation
npx peep-mcp benchmark
```

See [CHANGELOG.md](CHANGELOG.md) for full technical release notes, tool schemas, and empirical benchmarks.
