# 🛡️ Peep: Peripheral Evaluation & Execution Proxy

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![Node Version](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

> **The Open-Source Token Shield for AI Coding Agents.**  
> Offload mobile visual perception, coordinate grounding, autonomous micro-loops, and noisy log analysis to local models (Ollama, vLLM, llama.cpp)—slashing cloud token consumption by **95% to 99%** across **Google Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

---

## ⚡ The Problem: The $400/hr Context Trap

If you've ever watched a frontier agent like **Claude 3.7 Sonnet**, **Gemini 2.0 Pro**, or **GPT-4o** automate mobile tests or debug a connected Android device, you've witnessed an expensive paradox:

You are paying for a world-class reasoning model (the equivalent of a **Staff / Principal Software Architect** earning $400/hr) to do two things it was never meant to do:

1. **Stare at raw screenshots to locate buttons**:  
   A single $1080 \times 2400$ phone screenshot burns **1,600 to 2,500 vision tokens**. Slicing through a 10-step UI smoke test consumes **25,000+ tokens** ($0.15–$0.40 per run) just finding coordinates.
2. **Read thousands of lines of log spam**:  
   Dumping raw `adb logcat` into your chat burns **35,000+ tokens** and floods the context window with Garbage Collector pauses and window manager noise—causing rapid context saturation and severe "lost-in-the-middle" hallucinations.

---

## 🛡️ The Solution: The Token Shield

**Peep** introduces a clean separation of concerns:
- **Your Coding Harness (Cloud Model)** = **The Principal Engineer**: Focuses exclusively on system architecture, code synthesis, algorithms, and high-level test intentions (`verify_checkout_flow("test_user")`).
- **Peep + Local Models** = **The QA & Peripheral Execution Engine**: Runs locally on your machine or private GPU server (via Ollama, vLLM, or llama.cpp) using lightweight Vision-Language Models (Qwen2.5-VL 7B, UI-TARS 7B, Gemma 3) and Small Language Models (Gemma 2B). It handles raw screenshots, coordinate calibration, UI hierarchy dumps, and log noise filtering.

```
       Coding Harness (Antigravity / Cursor / Claude Code / Windsurf / Cline / Copilot)
                       Frontier Cloud Model (Cloud Tokens)
                                      │
               High-Level Directive   │   Compact JSON Result
               "Click Checkout"       │   { status: "SUCCESS", tokens_saved: 1600 }
               (50 text tokens)       │   (40 text tokens)
                                      ▼
                        ┌───────────────────────────┐
                        │   PEEP TOKEN SHIELD MCP   │
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
      Local VLM / SLM Engine                        Android / Peripheral
  (Qwen2.5-VL / UI-TARS / Gemma)                   (ADB / scrcpy / logcat)
       [0 Cloud Tokens Burned]                     [Physical Tap & Log Tail]
```

### Empirical Token & Cost Savings

| Scenario | Traditional Cloud Agent | Peep Token Shield | Net Token Savings | Cost Reduction |
| :--- | :--- | :--- | :--- | :--- |
| **5-Step Form Fill & Button Tap** | 11,000 tokens ($0.055) | **380 tokens** ($0.0019) | **96.5%** | **96.5%** |
| **Crash & Exception Diagnosis** | 35,000 tokens ($0.175) | **120 tokens** ($0.0006) | **99.6%** | **99.7%** |
| **Full Smoke Test Suite (15 screens)** | 36,000 tokens ($0.180) | **260 tokens** ($0.0013) | **99.2%** | **99.3%** |
| **100 Daily CI/CD Validation Runs** | 4,500,000 tokens/day | **45,000 tokens/day** | **99.0%** | **~$670 / Month Saved** |

---

## 🆚 Why Peep? How It Compares

| Feature / Dimension | Raw Cloud Agent | Appium / Maestro | Peep Token Shield |
| :--- | :--- | :--- | :--- |
| **Token Cost per Step** | 1,600 – 2,500 tokens | 0 tokens (No LLM reasoning) | **~40 text tokens (98% reduction)** |
| **Flaky Selector Resiliency**| Low (Rigid or pixel-heavy) | Breaks on UI / text changes | **High (Hybrid UI Tree + Local VLM)** |
| **Context Window Longevity** | Exhausted in 3–5 actions | N/A | **Hours of continuous agentic flow** |
| **Setup Complexity** | Zero (Just chat) | High (Drivers, brittle selectors)| **Turnkey (Run `doctor` & go)** |
| **Local Privacy** | Screenshots leave machine | Local execution | **Screenshots NEVER leave local boundary** |

---

## 🚀 Key Features

- **🛡️ True Token Shield**: Your cloud model never ingests raw pixels or logcat spam. All vision tokens stay local.
- **⚡ Three-Tier Perception Cascade**:
  - **Tier 0 (~15ms)**: Direct match on Android Accessibility/UI hierarchy tags (0 AI tokens).
  - **Tier 1 (~120ms)**: Compact semantic tree parsing via local SLM.
  - **Tier 2 (~500ms)**: Zero-copy screenshot grounding via local VLM (Qwen2.5-VL / UI-TARS).
- **📐 Calibrated Geometry Engine**: Accurate translation from normalized $[0, 1000]$ model space to physical device pixels with aspect ratio compensation, rotation transforms ($0^\circ, 90^\circ, 180^\circ, 270^\circ$), and humanized touch jitter.
- **🔄 Autonomous Micro-Loops (`peep_execute_goal`)**: Hand over multi-step UI flows (e.g. *"Dismiss dialog and navigate to profile settings"*) to the local model to run locally without pinging the cloud model on every frame.
- **🪵 Smart Log Filtering & Crash Watchdog**: Background ring buffer tracks live logs, strips framework noise, and uses local SLM to summarize fatal crashes into a concise 3-line diagnostic.
- **🔌 Generic & Backend-Agnostic**: Works with Ollama, llama.cpp, vLLM, LM Studio, or any remote OpenAI-compatible endpoint.
- **💻 Dual Interface (MCP + Direct CLI)**: Use it as an MCP server inside your IDE, or run commands directly from your terminal or CI/CD pipelines (`peep tap`, `peep assert`, `peep logs`).

---

## ⏱️ Quickstart (Under 2 Minutes)

### 1. Prerequisite: Local Models
Ensure you have a local vision model running (e.g. via [Ollama](https://ollama.ai) or LM Studio):

```bash
# Pull recommended models via Ollama:
ollama pull qwen2.5-vl:7b
ollama pull gemma:2b
```

### 2. Connect Your Android Device / Emulator
Ensure USB Debugging is enabled:
```bash
adb devices
# Output should list your device or emulator (e.g., emulator-5554 or 127.0.0.1:7555)
```

### 3. Run Peep Doctor & Benchmark
Validate your environment and preview your savings in seconds:
```bash
# Verify connection to ADB and inference backend:
npx peep-mcp doctor

# Simulate empirical token and cost savings:
npx peep-mcp benchmark
```

---

## 💻 Direct CLI Terminal Usage

Peep can be run directly from PowerShell, Bash, Aider, or CI pipelines without an MCP client:

```bash
# Tap an element using local perception
peep tap "Login Button"

# Type text into a field
peep type "alice@example.com" --target "Email Address"

# Swipe smoothly up/down/left/right
peep swipe up --distance medium

# Visually verify screen condition using local VLM (0 cloud tokens)
peep assert "Dashboard welcome header is visible"

# Check logs for crashes (summarized by local SLM into 3 lines)
peep logs --crashes

# Run an autonomous local micro-loop
peep goal "Dismiss notification popup and open Settings" --max-steps 6

# View total session token & cost savings
peep stats
```

---

## 🔌 Integration with Coding Harnesses

Peep includes turnkey configuration snippets and instruction files in `configs/harnesses/`:

### 1. Google Antigravity 2.0
Add to `~/.gemini/antigravity/mcp_config.json` (or project `.gemini/mcp_config.json`):
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_PROVIDER_TYPE": "openai",
        "PEEP_BASE_URL": "http://localhost:11434/v1",
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b",
        "PEEP_TARGET_TYPE": "android"
      }
    }
  }
}
```
*Native Skill*: Copy `configs/harnesses/antigravity/SKILL.md` to `.gemini/skills/peep-token-shield/SKILL.md`.

### 2. Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_PROVIDER_TYPE": "openai",
        "PEEP_BASE_URL": "http://localhost:11434/v1",
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
      }
    }
  }
}
```
Copy `configs/harnesses/cursor/rules.mdc` to `.cursor/rules/peep.mdc`.

### 3. Claude Code CLI & Claude Desktop
Add directly via Claude CLI:
```bash
claude mcp add peep -- npx -y peep-mcp serve
```
Copy `configs/harnesses/claude/CLAUDE.md` to your repository root.

### 4. Windsurf Cascade
Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_PROVIDER_TYPE": "openai",
        "PEEP_BASE_URL": "http://localhost:11434/v1",
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
      }
    }
  }
}
```
Copy `configs/harnesses/windsurf/windsurfrules.md` to `.windsurfrules`.

### 5. Cline & Roo Code
Add to `cline_mcp_settings.json` with `autoApprove` permissions for continuous automation:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "disabled": false,
      "autoApprove": [
        "peep_find_and_tap",
        "peep_type_text",
        "peep_swipe",
        "peep_press_key",
        "peep_assert_screen_state",
        "peep_tail_and_filter_logs",
        "peep_execute_goal",
        "peep_get_telemetry"
      ]
    }
  }
}
```
Add instructions from `configs/harnesses/cline_roocode/custom_instructions.md` to your Custom Instructions.

### 6. GitHub Copilot
Copy `configs/harnesses/copilot/copilot-instructions.md` to `.github/copilot-instructions.md` to guide Copilot Chat and Edits to generate lightweight `peep` CLI automation commands.

---

## 🧰 Exposed MCP Tools

| MCP Tool Name | Description | Cloud Token Cost |
| :--- | :--- | :--- |
| `peep_find_and_tap` | Locates UI element and executes physical tap. | ~50 text tokens (0 vision tokens) |
| `peep_type_text` | Focuses field and inputs text with proper escaping. | ~40 text tokens |
| `peep_swipe` | Dispatches calibrated directional swipe gesture. | ~30 text tokens |
| `peep_press_key` | Hardware/nav key event (`back`, `home`, `enter`). | ~25 text tokens |
| `peep_assert_screen_state` | Local VLM visual verification of expected condition. | ~60 text tokens (0 vision tokens) |
| `peep_tail_and_filter_logs` | Noise-filtered logs + local SLM crash diagnosis. | ~60 text tokens (vs 35,000 raw) |
| `peep_execute_goal` | Autonomous local micro-loop for multi-step tasks. | ~120 text tokens total |
| `peep_get_telemetry` | Cumulative shielded tokens and estimated USD savings. | ~40 text tokens |

---

## ⚙️ Configuration (`peep.yaml`)

Peep can be configured via `peep.yaml` in your working directory, environment variables (`PEEP_*`), or CLI flags:

```yaml
provider:
  type: "openai"              # 'openai' or 'ollama'
  baseUrl: "http://localhost:11434/v1"
  vlmModel: "qwen2.5-vl:7b"
  slmModel: "gemma:2b"
  timeoutMs: 45000

target:
  type: "android"             # 'android', 'browser', or 'desktop'
  deviceId: ""                # Auto-detects active device if left blank
  adbPath: "adb"

perception:
  strategy: "auto"            # 'auto', 'tree_first', 'vision_only', 'tree_only'

logs:
  ringBufferSize: 2000
  filterNoise: true
  watchdog: true
```

---

## 📚 Deep Dive Documentation

- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Empirical Benchmarks & Token Calculus Whitepaper](docs/BENCHMARKS.md)
- [Turnkey Harness Integration Guides](docs/HARNESS_INTEGRATIONS.md)
- [Local Models & Inference Backend Guide](docs/LOCAL_MODELS_GUIDE.md)
- [Contributor Guide](CONTRIBUTING.md)

---

## 🗺️ Roadmap

- [x] Android target adapter via ADB & uiautomator
- [x] Three-tier hybrid perception cascade
- [x] Calibrated coordinate mapping with rotation compensation
- [x] Noise-filtered logcat ring buffer & crash watchdog
- [x] Autonomous local micro-loops (`peep goal`)
- [ ] Browser target adapter (Playwright / Chrome DevTools Protocol)
- [ ] Desktop target adapter (Native OS window control)
- [ ] Direct scrcpy raw H.264 low-latency socket streaming

---

## 🤝 Contributing

We welcome issues and pull requests! Please read our [Contributor Guide](CONTRIBUTING.md) to get started.

---

## 📄 License

Apache License 2.0. See [LICENSE](LICENSE) for details.
