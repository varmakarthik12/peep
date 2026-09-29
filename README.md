# 🛡️ Peep: Peripheral Evaluation & Execution Proxy

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![Node Version](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

> **The Open-Source Token Shield for AI Coding Agents.**  
> Offload visual perception, coordinate grounding, autonomous micro-loops, and noisy log analysis to any local or private model (Ollama, vLLM, llama.cpp, or OpenAI-compatible endpoints)—slashing cloud token expenditure by **95% to 99%** across **Google Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

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
- **Peep + Local Models** = **The QA & Peripheral Execution Engine**: Runs locally on your machine or private GPU server using whatever local model backend you prefer (Ollama, vLLM, llama.cpp, or remote endpoints). It handles raw screenshots, coordinate calibration, UI hierarchy dumps, and log noise filtering.

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
       Local Model Engine                           Target Peripheral
  (Ollama / llama.cpp / vLLM)                   (Android / Browser / Desktop)
    [0 Cloud Tokens Burned]                        [Physical Tap & Log Tail]
```

### Empirical Token & Cost Savings

| Scenario | Traditional Cloud Agent | Peep Token Shield | Net Token Savings | Cost Reduction |
| :--- | :--- | :--- | :--- | :--- |
| **5-Step Form Fill & Button Tap** | 11,000 tokens ($0.055) | **380 tokens** ($0.0019) | **96.5%** | **96.5%** |
| **Crash & Exception Diagnosis** | 35,000 tokens ($0.175) | **120 tokens** ($0.0006) | **99.6%** | **99.7%** |
| **Full Smoke Test Suite (15 screens)** | 36,000 tokens ($0.180) | **260 tokens** ($0.0013) | **99.2%** | **99.3%** |
| **100 Daily CI/CD Validation Runs** | 4,500,000 tokens/day | **45,000 tokens/day** | **99.0%** | **~$670 / Month Saved** |

---

## 💡 Simplified Model Architecture: Do I need separate VLM and SLM?

**No! Peep is designed for zero friction:**
- **Single Model by Default**: You do **not** need to juggle separate vision and language models. A single multimodal model handles both screen coordinate grounding and log anomaly summarization.
- **Smart Auto-Detection**: When set to `model: "auto"`, Peep automatically queries your endpoint (`/v1/models` or `/api/tags`) and binds to the active model currently running on your server. Zero configuration required!
- **Optional Specialization**: If and only if you deliberately run two different models (e.g. a larger 7B model for vision and a lightweight 2B model for log parsing), you can optionally configure `visionModel` and `textModel`. If omitted, both gracefully default to `model`.

---

## 🎯 Multi-Target Architecture (Enabled Simultaneously by Default)

Unlike single-purpose tools, Peep features a unified `TargetManager` that supports **multiple targets enabled simultaneously**:
- **Android**: ADB integration with local or remote servers, screen frame capture, `uiautomator` accessibility trees, and ring-buffered `logcat` monitoring.
- **Browser**: Web automation adapter scaffold (Playwright / CDP) for web app validation.
- **Desktop**: Desktop OS window control adapter scaffold (MSS / display capture).

All enabled targets are active at startup. Tool calls auto-route to your primary active target, or you can pass an explicit `platform: "android" | "browser" | "desktop"` parameter.

---

## 🌐 Remote ADB Server & Network Device Support

Peep supports both local USB devices and remote enterprise or cloud device farms:
- **Remote ADB Server (`adbHost` & `adbPort`)**: Direct ADB commands to a remote ADB daemon over the network (`adb -H <host> -P <port>`).
- **Remote Device TCP/IP Auto-Connect (`connectAddress`)**: Automatically executes `adb connect <ip:port>` on startup for wireless debugging or remote cloud emulators.

---

## 🚀 Quickstart (Under 2 Minutes)

### 1. Ensure Local Inference is Running
Start your favorite local server (Ollama, llama.cpp, vLLM, LM Studio, etc.):
```bash
# Example with Ollama:
ollama run qwen2.5-vl:7b

# Or with llama.cpp:
llama-server -m your-model.gguf --port 11434
```

### 2. Verify System Health in 1 Second
Run Peep Doctor to auto-detect your connected device and model:
```bash
npx peep-mcp doctor
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

# Visually verify screen condition using local model
peep assert "Dashboard welcome header is visible"

# Check logs for crashes (summarized by local model)
peep logs --crashes

# Run an autonomous local micro-loop
peep goal "Dismiss notification popup and open Settings" --max-steps 6

# View total session token & cost savings
peep stats

# Connect to remote ADB server or network device on the fly
peep doctor --adb-host 192.168.1.50 --adb-port 5037
peep tap "Submit" --connect 192.168.1.100:5555
```

---

## 🔌 Coding Harness Integrations

Peep drops into any coding harness via standard MCP configuration:

### 1. Google Antigravity 2.0
In `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"],
      "env": {
        "PEEP_PROVIDER_TYPE": "openai",
        "PEEP_BASE_URL": "http://localhost:11434/v1",
        "PEEP_MODEL": "auto"
      }
    }
  }
}
```
*Native Skill*: Copy `configs/harnesses/antigravity/SKILL.md` to your Antigravity skills directory.

### 2. Cursor
In `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"]
    }
  }
}
```
Copy `configs/harnesses/cursor/rules.mdc` to `.cursor/rules/peep.mdc`.

### 3. Claude Desktop & Claude Code CLI
In `claude_desktop_config.json` or via CLI:
```bash
claude mcp add peep npx -y peep-mcp serve
```
Copy `configs/harnesses/claude/CLAUDE.md` to your repository root.

### 4. Windsurf Cascade
In `mcp_config.json`:
```json
{
  "mcpServers": {
    "peep": {
      "command": "npx",
      "args": ["-y", "peep-mcp", "serve"]
    }
  }
}
```
Copy `configs/harnesses/windsurf/windsurfrules.md` to `.windsurfrules`.

---

## ⚙️ Complete Configuration Reference (`peep.yaml`)

Peep can be configured via `peep.yaml` in your project root, environment variables (`PEEP_*`), or CLI flags.

```yaml
# ==============================================================================
# 1. INFERENCE PROVIDER
# ==============================================================================
provider:
  type: "openai"              # 'openai' (llama.cpp, vLLM, LM Studio, OpenRouter) or 'ollama'
  baseUrl: "http://localhost:11434/v1" # Endpoint base URL
  apiKey: ""                  # Optional API token for authenticated remote endpoints
  model: "auto"               # Primary model ('auto' automatically detects active model)
  visionModel: "auto"         # Optional: override specifically for vision grounding
  textModel: "auto"           # Optional: override specifically for log/text diagnosis
  timeoutMs: 45000            # Inference request timeout in milliseconds
  temperature: 0.1            # Sampling temperature (0.0 - 0.2 recommended for coordinates)

# ==============================================================================
# 2. TARGET PLATFORMS
# ==============================================================================
target:
  # List of enabled platforms (default: all enabled)
  enabled:
    - "android"
    - "browser"
    - "desktop"
  defaultPlatform: "android"  # Default fallback platform

  # Android-specific settings
  android:
    deviceId: ""              # Target device ID (leave empty for auto-detection)
    adbPath: "adb"            # Path to adb binary
    adbHost: ""               # Optional remote ADB server host (e.g. "192.168.1.50")
    adbPort: 5037             # Optional remote ADB server port
    connectAddress: ""        # Optional remote device IP:port to auto-connect (e.g. "192.168.1.100:5555")
    scrcpyPath: "scrcpy"      # Optional scrcpy path

  # Browser-specific settings
  browser:
    headless: false           # Run browser headlessly
    viewport:
      width: 1920
      height: 1080

  # Desktop-specific settings
  desktop:
    displayIndex: 0           # Primary monitor index

# ==============================================================================
# 3. PERCEPTION & GROUNDING
# ==============================================================================
perception:
  strategy: "auto"            # 'auto', 'tree_first', 'vision_only', 'tree_only'
  confidenceThreshold: 0.7    # Minimum confidence score for visual detections
  coordinateScale: 1000       # Normalized coordinate space (default: 0-1000)

# ==============================================================================
# 4. LOG TAILING & CRASH WATCHDOG
# ==============================================================================
logs:
  ringBufferSize: 2000        # Lines retained in memory ring buffer
  filterNoise: true           # Suppress framework noise (GC pauses, choreographer)
  watchdog: true              # Detect fatal crashes and ANRs during execution
  maxAnomalyLines: 10         # Max stack lines extracted in summaries

# ==============================================================================
# 5. LOGGING LEVEL
# ==============================================================================
logLevel: "info"              # 'debug', 'info', 'warn', 'error', 'silent'
```

---

## 🛠️ Exposed MCP Tools

| MCP Tool Name | Description | Cloud Token Cost |
| :--- | :--- | :--- |
| `peep_find_and_tap` | Locates UI element and executes physical tap. | ~50 text tokens (0 vision tokens) |
| `peep_type_text` | Focuses field and inputs text with proper escaping. | ~40 text tokens |
| `peep_swipe` | Dispatches calibrated directional swipe gesture. | ~30 text tokens |
| `peep_press_key` | Hardware/nav key event (`back`, `home`, `enter`). | ~25 text tokens |
| `peep_assert_screen_state` | Local visual verification of expected condition. | ~60 text tokens (0 vision tokens) |
| `peep_tail_and_filter_logs` | Noise-filtered logs + local crash diagnosis. | ~60 text tokens (vs 35,000 raw) |
| `peep_execute_goal` | Autonomous local micro-loop for multi-step tasks. | ~120 text tokens total |
| `peep_get_telemetry` | Cumulative shielded tokens and estimated USD savings. | ~40 text tokens |

---

## 📚 Documentation

- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Empirical Benchmarks & Token Calculus](docs/BENCHMARKS.md)
- [Harness Integration Guides](docs/HARNESS_INTEGRATIONS.md)
- [Local Models & Inference Setup](docs/LOCAL_MODELS_GUIDE.md)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for local development workflows and guidelines.

---

## 📄 License

Apache License 2.0. See [LICENSE](LICENSE) for details.
