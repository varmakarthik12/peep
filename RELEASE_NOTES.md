# 🛡️ Peep v0.1.0 — Initial Release

We are proud to introduce **Peep (Peripheral Evaluation & Execution Proxy)**: The Open-Source Token Shield for AI Coding Agents.

Peep offloads mobile visual perception, coordinate grounding, autonomous micro-loops, and noisy log analysis to local models (Ollama, vLLM, llama.cpp)—slashing cloud token consumption by **95% to 99%** across Antigravity 2.0, Cursor, Claude Code, Copilot, Windsurf, and Cline.

---

### 🚀 Key Capabilities

- **True Token Shield**: Frontier models in your IDE act as the *Principal Engineer*, issuing high-level intentions. Peep and local SLM/VLMs act as the *QA Execution Engine*, completely shielding cloud context from raw screenshots and logcat spam.
- **Three-Tier Perception Cascade**:
  - **Tier 0 (~15ms)**: Direct match on Android Accessibility/UI hierarchy tags (0 AI tokens).
  - **Tier 1 (~120ms)**: Compact semantic tree parsing via local SLM.
  - **Tier 2 (~500ms)**: Zero-copy screenshot grounding via local VLM (Qwen2.5-VL / UI-TARS).
- **Calibrated Geometry Engine**: Accurate translation from normalized `[0, 1000]` model space to physical device pixels with aspect ratio compensation, rotation transforms (0°, 90°, 180°, 270°), and humanized touch jitter.
- **Autonomous Micro-Loops (`peep_execute_goal`)**: Hands multi-step UI flows (e.g. "Dismiss dialog and navigate to profile settings") to the local model to run locally without pinging the cloud model on every frame.
- **Smart Log Filtering & Crash Watchdog**: Background ring buffer tracks live logs, strips framework noise, and uses local SLM to summarize fatal crashes into a concise 3-line diagnostic.
- **Dual Interface**: Runs as a standard Model Context Protocol (MCP) server over `stdio` (`peep serve`), or directly as a terminal CLI tool (`peep tap`, `peep type`, `peep swipe`, `peep assert`, `peep logs --crashes`).

---

### 📦 Quickstart

```bash
# Verify environment in 1 second
npx peep-mcp doctor

# Run benchmark token savings simulation
npx peep-mcp benchmark
```

---

### 🔌 Coding Harness Integrations

Turnkey configurations and instruction skills are included for:
- Google Antigravity 2.0 (native `SKILL.md`)
- Cursor (`.cursor/rules/peep.mdc`)
- Claude Desktop & Claude Code CLI (`CLAUDE.md`)
- Windsurf Cascade (`.windsurfrules`)
- Cline & Roo Code
- GitHub Copilot

---

### 📦 Artifacts Included
- `peep-mcp-0.1.0.tgz` (Universal npm distribution tarball)
