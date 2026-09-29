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
- **Optional Specialization**: If and only if you deliberately run two different models (e.g. a larger model for vision grounding and a lightweight model for log parsing), you can optionally configure `visionModel` and `textModel`. If omitted, both gracefully default to `model`.

### ❓ Is a Local Model Even Mandatory? What is the Default Fallback?

**No, a local model is NOT mandatory for standard UI automation!**

Peep implements a high-performance tiered fallback architecture:
1. **Tier 0 Deterministic Hierarchy Grounding (~15ms, 0 AI Tokens, 0 Models Needed)**:  
   When you tap or type (`peep tap "Sign In"`), Peep defaults to `strategy: "auto"`. It first inspects the platform's native accessibility hierarchy (`uiautomator dump` on Android, DOM on browser, accessibility tree on desktop). If the element exists by text, content description, or ID, Peep calculates coordinates and clicks it in **~15ms with 0 AI models and 0 tokens**.
2. **Deterministic Regex Log & Crash Filtering (< 2ms, 0 AI Tokens, 0 Models Needed)**:  
   `peep logs` and the background crash watchdog rely on high-performance in-memory regex filters (detecting `FATAL EXCEPTION`, `ANR`, `SIGSEGV`, uncaught exceptions). This operates in < 2ms without needing any local model.
3. **When IS a Local Model Used?**:  
   The local model is only invoked as an intelligent fallback when:
   - **Visual Grounding is Required**: The target element is a custom-drawn canvas, Flutter widget, game view, or an unlabelled graphic icon that does not appear in the accessibility tree.
   - **Visual Assertions**: You explicitly call `peep_assert_screen_state` or `peep assert "Order confirmation is visible"` to visually inspect screen pixels.
   - **High-Level Log Summaries**: You request an AI-generated natural language summary of a complex stack trace.

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

### 1. Ensure Local Inference is Running (Optional)
Start your favorite local server (Ollama, llama.cpp, vLLM, LM Studio, etc.):
```bash
# Example with Ollama (any multimodal model):
ollama run llama3.2-vision

# Or with llama.cpp:
llama-server -m your-model.gguf --port 11434
```
*(Remember: If you don't run a local model, Peep still operates using Tier 0 native accessibility tree matching and deterministic log filtering!)*

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

### Detailed Configuration Breakdown

#### 1. Inference Provider Settings (`provider`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `type` | `PEEP_PROVIDER_TYPE` | `"openai" \| "ollama"` | `"openai"` | Optional | Inference protocol. `"openai"` works with llama.cpp, vLLM, LM Studio, Ollama `/v1`, and OpenRouter. `"ollama"` uses native Ollama RPC. |
| `baseUrl` | `PEEP_BASE_URL` | `string` | `"http://localhost:11434/v1"` | Optional | HTTP endpoint URL of the inference server. |
| `apiKey` | `PEEP_API_KEY` | `string` | `""` | Optional | Bearer authentication token for remote endpoints (OpenRouter, private cloud gateways). |
| `model` | `PEEP_MODEL` | `string` | `"auto"` | Optional | Primary model name. When `"auto"`, Peep queries `/v1/models` or `/api/tags` and auto-binds to the active model. |
| `visionModel` | `PEEP_VLM_MODEL` | `string` | inherits `model` | Optional | Override specifically for visual perception / coordinate grounding. |
| `textModel` | `PEEP_SLM_MODEL` | `string` | inherits `model` | Optional | Override specifically for log anomaly diagnosis. |
| `timeoutMs` | `PEEP_TIMEOUT_MS` | `number` | `45000` | Optional | Request timeout in milliseconds before failing over or aborting. |
| `temperature` | `PEEP_TEMPERATURE` | `number` | `0.1` | Optional | Sampling temperature (keep low $\le 0.2$ for accurate coordinate extraction). |

#### 2. Target Platforms (`target`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `enabled` | `PEEP_TARGET_ENABLED` | `string[]` | `["android", "browser", "desktop"]` | Optional | Array of platforms enabled simultaneously. Tool calls auto-route or accept `platform: "android"`. |
| `defaultPlatform` | `PEEP_DEFAULT_PLATFORM` | `"android" \| "browser" \| "desktop"` | `"android"` | Optional | Fallback platform when a tool call does not specify `platform`. |

##### Android Platform Settings (`target.android`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `PEEP_DEVICE_ID` | `string` | `""` (auto) | Optional | Specific ADB device serial. If empty, Peep auto-detects the first online device. |
| `adbPath` | `PEEP_ADB_PATH` | `string` | `"adb"` | Optional | Path or command name for the `adb` executable. |
| `adbHost` | `PEEP_ADB_HOST` | `string` | `""` | Optional | Remote ADB server hostname or IP address (`adb -H <host>`). |
| `adbPort` | `PEEP_ADB_PORT` | `number` | `5037` | Optional | Remote ADB server port (`adb -P <port>`). |
| `connectAddress` | `PEEP_CONNECT_ADDRESS`| `string` | `""` | Optional | Remote device network IP:port to automatically connect via `adb connect` (e.g. `"192.168.1.100:5555"`). |
| `scrcpyPath` | `PEEP_SCRCPY_PATH` | `string` | `"scrcpy"` | Optional | Optional path to `scrcpy` binary for low-latency H.264 video streaming. |

##### Browser Platform Settings (`target.browser`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `headless` | `PEEP_BROWSER_HEADLESS`| `boolean` | `false` | Optional | Whether to launch headless browser instance. |
| `viewport.width` | `PEEP_VIEWPORT_WIDTH` | `number` | `1920` | Optional | Virtual browser viewport width in pixels. |
| `viewport.height`| `PEEP_VIEWPORT_HEIGHT`| `number` | `1080` | Optional | Virtual browser viewport height in pixels. |

##### Desktop Platform Settings (`target.desktop`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `displayIndex` | `PEEP_DISPLAY_INDEX` | `number` | `0` | Optional | Index of the physical display monitor to capture and interact with. |

#### 3. Perception & Grounding (`perception`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `strategy` | `PEEP_STRATEGY` | `"auto" \| "tree_first" \| "vision_only" \| "tree_only"` | `"auto"` | Optional | Perception strategy. `"auto"` tries native accessibility tree first (0ms, 0 AI tokens), falling back to local vision model. |
| `confidenceThreshold` | `PEEP_CONFIDENCE_THRESHOLD` | `number` | `0.7` | Optional | Minimum confidence score $(0.0 - 1.0)$ required to accept visual grounding. |
| `coordinateScale` | `PEEP_COORDINATE_SCALE` | `number` | `1000` | Optional | Normalized coordinate range (e.g., $1000$ maps to $[0, 1000]$ normalized space). |

#### 4. Log Tailing & Crash Watchdog (`logs`)
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ringBufferSize` | `PEEP_LOG_RING_BUFFER` | `number` | `2000` | Optional | Maximum number of log lines retained in the in-memory FIFO queue. |
| `filterNoise` | `PEEP_FILTER_NOISE` | `boolean` | `true` | Optional | Strips high-frequency framework noise (Choreographer, GC pauses, ViewRootImpl). |
| `watchdog` | `PEEP_WATCHDOG` | `boolean` | `true` | Optional | Background watchdog that monitors fatal exceptions, ANRs, and SIGSEGVs synchronously. |
| `maxAnomalyLines`| `PEEP_MAX_ANOMALY_LINES`| `number` | `10` | Optional | Maximum stack trace lines included in concise JSON crash summaries. |

#### 5. General Settings
| Parameter | Env Variable | Type | Default | Optional? | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `logLevel` | `PEEP_LOG_LEVEL` | `"debug" \| "info" \| "warn" \| "error" \| "silent"` | `"info"` | Optional | Console logging verbosity for Peep server and CLI. |

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
