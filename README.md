# 🛡️ Peep: Peripheral Evaluation & Execution Proxy

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![Node Version](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

> **The Open-Source Token Shield for AI Coding Agents.**  
> Offload visual perception, coordinate grounding, autonomous micro-loops, and noisy log analysis to any local or private model (Ollama, vLLM, llama.cpp, or OpenAI-compatible endpoints)—slashing cloud token expenditure by **95% to 99%** across **Google Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and GitHub Copilot**.

---

## ⚡ The Problem: The $400/hr Context Trap

If you've ever watched a frontier cloud model automate mobile tests or debug a connected Android device, you've witnessed an expensive paradox:

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
- **Android** *(Production Ready)*: ADB integration with local or remote servers, screen frame capture, `uiautomator` accessibility trees, and ring-buffered `logcat` monitoring.
- **Browser** *(v0.2 Adapter Scaffold)*: Web automation adapter scaffold (Playwright / CDP) for web app validation.
- **Desktop** *(v0.2 Adapter Scaffold)*: Desktop OS window control adapter scaffold (MSS / display capture).

All enabled targets are active at startup. Tool calls auto-route to your primary active target (`defaultPlatform: "android"`), or an AI harness (such as Antigravity 2.0, Cursor, Claude Code, or Windsurf) can pass an explicit `platform: "android" | "browser" | "desktop"` parameter based on the context of the user request. If a scaffold target is requested, Peep responds with a clean, structured notification and guidance without crashing the agent loop.

---

## 📱 Android Device Targeting (Device ID & Zero-Config Auto-Discovery)

Peep makes connecting to Android devices and emulators effortless:

### 1. Zero-Config Auto-Discovery
If you have **one Android emulator or physical device connected**, you do **not** need to configure any device ID or port. Peep queries ADB, detects the online target, checks display resolution, and auto-binds instantly.

### 2. Explicit Device Targeting (`deviceId`)
When you have multiple devices attached (e.g. an emulator and a physical phone), specify which device Peep should command:
- In MCP configuration: `"PEEP_DEVICE_ID": "localhost:7555"`
- In `peep.yaml`: `deviceId: "localhost:7555"`
- In CLI: `peep -d localhost:7555 tap "Login"`

To inspect all attached devices, hardware models, and serials in 1 second, run:
```bash
npx peep-mcp devices
```

### Common Device Sockets Reference
| Device / Emulator | Socket / Serial ID | Peep Configuration |
| :--- | :--- | :--- |
| **Android Studio AVD** | `emulator-5554` | Auto-detected, or `PEEP_DEVICE_ID="emulator-5554"` |
| **MuMu Player 6 & 12** | `localhost:7555` *(or `127.0.0.1:7555`)* | `PEEP_DEVICE_ID="localhost:7555"` |
| **BlueStacks 5** | `127.0.0.1:5555` | `PEEP_DEVICE_ID="127.0.0.1:5555"` |
| **Nox Player** | `127.0.0.1:62001` | `PEEP_DEVICE_ID="127.0.0.1:62001"` |
| **LDPlayer 9** | `127.0.0.1:5555` | `PEEP_DEVICE_ID="127.0.0.1:5555"` |
| **Physical Phone (USB)** | Alphanumeric (from `peep devices`) | Auto-detected, or `PEEP_DEVICE_ID="RF8M10XXXXX"` |
| **Wi-Fi Debugging** | `<device-ip>:<port>` | `PEEP_CONNECT_ADDRESS="192.168.1.100:5555"` |

> [!NOTE]
> **No Remote Ports Needed**: You do not need to configure any ADB host or port for local emulators or USB devices. Emulator sockets (like `7555` or `5555`) are **Device IDs**, not ADB daemon ports. (For advanced enterprise setups running remote ADB daemons across Docker/CI, see the [Android Device Guide](docs/ANDROID_DEVICE_GUIDE.md)).

---

## 📦 Prerequisites & System Installation

Peep runs cleanly across macOS, Windows, and Linux. Ensure the following tools are available in your environment:

### 1. Node.js (>= 18.0.0) — **Required**
Runtime required for Peep CLI and MCP Server.
- **macOS**: `brew install node` *(or via nvm: `nvm install --lts`)*
- **Windows**: `winget install OpenJS.NodeJS.LTS` *(or `choco install nodejs-lts`)*
- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y nodejs npm`
- **Linux (Arch)**: `sudo pacman -S nodejs npm`

Verify: `node -v`

### 2. Android Debug Bridge (`adb`) — **Required for Android Automation**
Command-line bridge used by Peep to inspect accessibility trees, tap elements, swipe, and tail logs.
- **macOS**: `brew install android-platform-tools`
- **Windows**: `winget install Google.PlatformTools` *(or `choco install adb`)*
- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y android-tools-adb`
- **Linux (Fedora/RHEL)**: `sudo dnf install -y android-tools`
- **Linux (Arch)**: `sudo pacman -S android-tools`

Verify: `adb version`

> [!NOTE]
> If Android Studio is already installed, `adb` is already present on your machine in:
> - **macOS**: `~/Library/Android/sdk/platform-tools`
> - **Windows**: `%LOCALAPPDATA%\Android\Sdk\platform-tools`
> - **Linux**: `~/Android/Sdk/platform-tools`  
> Simply ensure that directory is added to your system `PATH`.

### 3. scrcpy — **Optional (Performance Boost)**
Peep automatically detects `scrcpy` if present to stream H.264 screen frames at ultra-low latency.
- **What if scrcpy is NOT installed?** Peep automatically falls back to native `adb exec-out screencap -p` with zero configuration or errors. It is strictly optional!
- **macOS**: `brew install scrcpy`
- **Windows**: `winget install Genymobile.scrcpy` *(or `choco install scrcpy`)*
- **Linux**: `sudo apt install -y scrcpy`

### 4. Local Model Runner — **Optional (For Local Visual Perception & AI Assertions)**
If you want local AI vision grounding or natural language screen assertions (`peep assert ...`):
```bash
# Any multimodal model via Ollama:
ollama run llama3.2-vision
# Or via llama.cpp, vLLM, LM Studio (OpenAI-compatible /v1 endpoint)
```
*(Remember: Standard apps are fully automated using Tier 0 native accessibility trees with 0 AI models and 0 tokens burned!)*

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
# List all connected Android devices/emulators and connection status
peep devices

# Run system diagnostics & verify display resolution
peep doctor

# Target a specific device (by serial or emulator socket)
peep -d localhost:7555 tap "Login Button"

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

# Auto-connect to a Wi-Fi debugging device on the fly
peep tap "Submit" --connect 192.168.1.100:5555
```

---

## 🔌 Coding Harness Integrations

Peep drops into any modern AI coding harness via standard MCP configuration. For each harness below, add the MCP server configuration and run the one-line terminal command to download the skill/rule directly from GitHub:

### 1. Google Antigravity 2.0
In `~/.gemini/config/mcp_config.json` (or `.gemini/mcp_config.json` in your workspace):
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
*(Tip: To target a specific emulator like MuMu, add `"PEEP_DEVICE_ID": "localhost:7555"` to `env`. Omit for zero-config auto-detection).*

**Install the `/peep` Slash Command directly from GitHub:**
- **macOS / Linux**:
  ```bash
  mkdir -p ~/.gemini/config/skills/peep && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md -o ~/.gemini/config/skills/peep/SKILL.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path "$HOME\.gemini\config\skills\peep"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md" -OutFile "$HOME\.gemini\config\skills\peep\SKILL.md"
  ```
*(Or install into your project workspace by replacing `$HOME\.gemini\config\skills\peep` with `.agents\skills\peep`)*

---

### 2. Cursor
In `.cursor/mcp.json`:
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

**Install Cursor Rule (`.cursor/rules/peep.mdc`) directly from GitHub:**
- **macOS / Linux**:
  ```bash
  mkdir -p .cursor/rules && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cursor/rules.mdc -o .cursor/rules/peep.mdc
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path ".cursor\rules"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cursor/rules.mdc" -OutFile ".cursor\rules\peep.mdc"
  ```

---

### 3. Claude Desktop & Claude Code CLI
Add the MCP server via CLI:
```bash
claude mcp add peep npx -y peep-mcp serve
```

**Install project instructions (`CLAUDE.md`) directly from GitHub:**
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/claude/CLAUDE.md -o CLAUDE.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/claude/CLAUDE.md" -OutFile "CLAUDE.md"
  ```

---

### 4. Windsurf Cascade
In `mcp_config.json`:
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

**Install Windsurf Rules (`.windsurfrules`) directly from GitHub:**
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/windsurf/windsurfrules.md -o .windsurfrules
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/windsurf/windsurfrules.md" -OutFile ".windsurfrules"
  ```

---

### 5. Cline & Roo Code
In `mcp_settings.json`:
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

**Download Custom Instructions directly from GitHub:**
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cline_roocode/custom_instructions.md -o cline_peep_instructions.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cline_roocode/custom_instructions.md" -OutFile "cline_peep_instructions.md"
  ```

---

### 6. GitHub Copilot (VS Code & JetBrains)
**Install Instructions (`.github/copilot-instructions.md`) directly from GitHub:**
- **macOS / Linux**:
  ```bash
  mkdir -p .github && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/copilot/copilot-instructions.md -o .github/copilot-instructions.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path ".github"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/copilot/copilot-instructions.md" -OutFile ".github\copilot-instructions.md"
  ```

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
    deviceId: ""              # Target device serial/socket (leave empty for auto-detection)
    adbPath: "adb"            # Path to adb binary
    connectAddress: ""        # Optional Wi-Fi device IP:port to auto-connect (e.g. "192.168.1.100:5555")
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
| `deviceId` | `PEEP_DEVICE_ID` | `string` | `""` (auto) | Optional | Specific ADB device serial or socket (e.g. `localhost:7555` or `emulator-5554`). If empty, Peep auto-detects the first online device. |
| `adbPath` | `PEEP_ADB_PATH` | `string` | `"adb"` | Optional | Path or command name for the `adb` executable. |
| `connectAddress` | `PEEP_CONNECT_ADDRESS`| `string` | `""` | Optional | Remote Wi-Fi device IP:port to automatically connect via `adb connect` (e.g. `"192.168.1.100:5555"`). |
| `scrcpyPath` | `PEEP_SCRCPY_PATH` | `string` | `"scrcpy"` | Optional | Optional path to `scrcpy` binary for low-latency H.264 video streaming. |

> [!TIP]
> **Complete Android Guide & Remote ADB Daemons**:
> For in-depth instructions on USB debugging, Wi-Fi pairing, multi-device setups, and remote ADB daemons (`adbHost` / `adbPort`), see the [Android Device Setup & Troubleshooting Guide](docs/ANDROID_DEVICE_GUIDE.md).

###### Common Emulator Ports & Default Sockets

| Emulator / Target | Serial / Socket | Peep Configuration |
| :--- | :--- | :--- |
| **Android Studio AVD** | `emulator-5554` | Auto-detected, or `PEEP_DEVICE_ID="emulator-5554"` |
| **MuMu Player 6 & 12** | `127.0.0.1:7555` or `localhost:7555` | `PEEP_DEVICE_ID="localhost:7555"` |
| **BlueStacks 5** | `127.0.0.1:5555` | `PEEP_DEVICE_ID="127.0.0.1:5555"` |
| **Nox Player** | `127.0.0.1:62001` | `PEEP_DEVICE_ID="127.0.0.1:62001"` |
| **LDPlayer 9** | `127.0.0.1:5555` | `PEEP_DEVICE_ID="127.0.0.1:5555"` |
| **Genymotion** | `127.0.0.1:6555` | `PEEP_DEVICE_ID="127.0.0.1:6555"` |
| **Physical Phone (USB)** | Alphanumeric (e.g. `RF8M10XXXXX`) | Auto-detected, or `PEEP_DEVICE_ID="RF8M10XXXXX"` |
| **Wi-Fi Debugging** | `<device_ip>:<port>` | `PEEP_CONNECT_ADDRESS="192.168.1.100:5555"` |

> [!WARNING]
> **ADB Daemon Port vs Device Socket**:
> `adbPort` (default `5037`) is the port of the background **ADB Server Daemon**. The emulator socket (e.g., `7555` for MuMu or `5555` for BlueStacks) is the **`deviceId`**, **not** the `adbPort`. Setting `adbPort: 7555` instructs ADB to look for the server daemon on port 7555 and will hang. Keep `adbPort` at `5037` (or omit it) and set `deviceId: "localhost:7555"`.

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

- [Android Device Setup & Troubleshooting Guide](docs/ANDROID_DEVICE_GUIDE.md)
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
