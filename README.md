# 🛡️ Peep

> **The Open-Source Token Shield for AI Coding Harnesses.**  
> Offload visual perception, coordinate grounding, app lifecycle, and noisy log analysis to local models and deterministic accessibility trees—cutting cloud token expenditure by **95% to 99.6%**.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

---

## ⚡ Why Peep? The $400/hr Context Trap

Frontier models powering modern AI coding harnesses are the equivalent of **Principal Architects**. Paying them to find buttons on raw screenshots and read thousands of lines of `logcat` spam is an expensive anti-pattern:

- **1080×2400 phone screenshots burn 1,600–2,500 vision tokens per frame.** Slicing through a 10-step UI smoke test burns 25,000+ tokens just finding coordinates.
- **Dumping raw `adb logcat` floods chat context with 35,000+ tokens** of GC pauses and window manager noise, causing rapid context saturation and severe "lost-in-the-middle" hallucinations.
- **Raw shell taps are crash-blind:** `adb shell input tap` returns exit code `0` even if the target app has died, thrown an ANR, or displayed a fatal exception dialog.

**Peep fixes this with a clean separation of concerns:**  
Your frontier cloud model stays high-level (`"Verify user login and cart checkout"`). Peep acts as the **local execution shield**, finding coordinates, dispatching gestures, filtering logs, and returning ultra-compact JSON (~40 tokens).

| Scenario | Raw Cloud Agent | With Peep Token Shield | Net Savings |
| :--- | :--- | :--- | :--- |
| **5-Step Form & Button Tap** | 11,000 tokens ($0.055) | **380 tokens** ($0.0019) | **96.5%** |
| **Crash & Exception Check** | 35,000 tokens ($0.175) | **120 tokens** ($0.0006) | **99.6%** |
| **15-Screen Smoke Test** | 36,000 tokens ($0.180) | **260 tokens** ($0.0013) | **99.2%** |
| **100 Daily CI/CD Runs** | 4,500,000 tokens/day | **45,000 tokens/day** | **~$670/month saved** |

---

## 🚀 Quickstart in 30 Seconds

### 1. Prerequisites
- **Node.js**: `>= 20.0.0` (LTS recommended)
- **ADB (`android-platform-tools`)**: Installed and available in your system `PATH` (or bundled with Android Studio).

### 2. Verify Your Environment
Plug in an Android device (USB debugging enabled) or launch an emulator (AVD, MuMu, BlueStacks, LDPlayer):
```bash
npx peep-mcp doctor
```
Peep auto-detects your connected device, queries screen resolution, and verifies connectivity in under a second.

### 3. Plug into Your AI Coding Harness
Add Peep as an MCP server to your harness of choice (**Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, Copilot**):

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
> [!TIP]
> Targeting a specific emulator or physical device? Add `"PEEP_DEVICE_ID": "localhost:7555"` to `env`. Leave empty for zero-config auto-detection.

👉 *Looking for turnkey slash commands and rules for each harness? See the [Harness Integration Guide](docs/HARNESS_INTEGRATIONS.md).*

---

## 🧠 How It Works: Cascading Perception

Peep uses a tiered fallback architecture to maximize execution speed and eliminate cloud vision token burn:

```
        Frontier Cloud Model (Harness)
             │ "Tap Checkout" (50 tokens)
             ▼
   ┌───────────────────────────────────┐
   │       PEEP TOKEN SHIELD MCP       │
   └─────────────────┬─────────────────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
    Tier 0        Tier 1        Tier 2
  Native Tree   Log Ring Buffer  Local VLM
  (~15ms, 0 AI)  (Zero-spam)   (Open-weight)
       │             │             │
       └─────────────┼─────────────┘
                     ▼
        Compact Result (~40 tokens)
```

1. **Tier 0 — Semantic Accessibility Tree (~15ms, 0 AI Tokens, No Model Needed)**:  
   Taps and inputs default to `strategy: "auto"`. Peep queries the platform's native accessibility hierarchy (`uiautomator dump` on Android, DOM on web). If the label, text, or ID exists, Peep calculates physical coordinates and clicks it immediately in **~15ms with 0 AI models and 0 tokens**.
2. **Tier 1 — In-Memory Logcat Ring Buffer (< 2ms, Zero Context Flood)**:  
   Peep tails device logs in a circular memory buffer (2,000 lines), stripping out framework noise (GC pauses, Choreographer drops). When an anomaly occurs, Peep extracts a concise 3-line diagnostic (`culprit`, `cause`, `stackSnippet`) rather than dumping 35,000 lines of logcat into your conversation.
3. **Tier 2 — Local Multimodal Vision (0 Cloud Tokens)**:  
   For custom canvas drawings, Flutter widgets, game screens, or unlabelled graphics where no accessibility node exists, Peep captures the frame locally and queries your local vision model (via Ollama, llama.cpp, or vLLM). Raw pixels never leave your machine.

---

## 💻 Direct CLI Cheat Sheet

Peep can be run directly from your terminal, CI runners, or shell scripts without an MCP client:

```bash
# 📱 App Lifecycle & State
peep launch com.example.app/.MainActivity   # Launch app with startup crash check
peep stop com.example.app                  # Force stop application cleanly
peep clear com.example.app                 # Factory reset app data & cache
peep restart com.example.app               # Clean stop & restart
peep install ./build/app-release.apk       # Install APK with auto-permissions (-g)
peep state                                 # Inspect foreground activity & battery

# 👁️ Pure Visual Analysis & Location (Zero Screen Mutation)
peep locate "Checkout Button"               # Locate element bounds & click coords without tapping
peep analyze                                # Inspect screen layout, scroll state (top/mid/bot) & landmarks
peep analyze "Verify cart items loaded"     # Visual evaluation with natural language focus prompt

# 👆 Touch, Gestures & Clipboard
peep tap "Sign In"                         # Tap element by label, ID, or local vision
peep type "dev@example.com" --target "Email" # Focus field and type text
peep swipe up --distance medium            # Smooth directional gestures
peep press back                            # Hardware keys: back, home, enter, tab
peep wake                                  # Wake display and dismiss keyguard
peep clipboard set "secret_token_123"      # Safe clipboard I/O without shell escaping

# 🔍 Assertions & Local Micro-Loops
peep assert "Welcome back, Alex"           # Local visual verification (0 cloud tokens)
peep goal "Dismiss popup and open Settings" --max-steps 6 # Run autonomous local loop

# 🛠️ Root, Debug & System Diagnostics
peep logs --crashes                        # Filter logs & extract 3-line crash diagnostic
peep kill com.example.app --root           # Exterminate stubborn process & daemons (kill -9)
peep reload zygote                         # Fast reload of LSPosed/Xposed hooks (~1.5s)
peep root "id"                             # Execute shell command with root / su
peep doctor                                # Check device, resolution, and model status
peep stats                                 # View cumulative session tokens & USD saved
```

---

## 🎯 Supported Target Peripherals

Peep features a unified `TargetManager` that supports multiple targets simultaneously:

- **Android (Production Ready)**: Full support for physical USB phones, Wi-Fi debugging, Android Studio AVDs, and third-party emulators (MuMu, BlueStacks, Nox, LDPlayer, WSA).
- **Web Browser (Playwright / CDP)**: Distilled semantic DOM extraction and automated browser navigation.
- **Desktop (Display & Windows)**: Cross-platform OS window management (`list`, `focus`, `metrics`) for macOS, Windows, and Linux.
- **iOS (Adapter Scaffold)**: Extensible adapter stub for Apple device instrumentation (IDB / XCUITest).

---

## 📚 Deep-Dive Documentation

For detailed port mappings, multi-device orchestration, and per-harness rules, explore our dedicated guides:

- 🔌 **[Harness Integration Guide](docs/HARNESS_INTEGRATIONS.md)**: Complete copy-paste setups and native rules for **Antigravity 2.0, Cursor, Claude Code, Windsurf, Cline, and Copilot**.
- 📱 **[Android Device & Emulator Guide](docs/ANDROID_DEVICE_GUIDE.md)**: Emulator socket reference (MuMu `7555`, BlueStacks `5555`), Wi-Fi pairing, USB setup, and daemon port disambiguation.
- 🏗️ **[System Architecture](docs/ARCHITECTURE.md)**: The 3-tier perception cascade, coordinate geometry engine, and strict anti-raw-ADB boundary.
- 🧠 **[Local Models & Inference Guide](docs/LOCAL_MODELS_GUIDE.md)**: Zero-config auto-detection and setup for Ollama, llama.cpp, vLLM, and LM Studio.
- 📊 **[Empirical Benchmarks Whitepaper](docs/BENCHMARKS.md)**: Exact token calculus, latency comparisons, and team ROI calculations.

---

## 📄 License & Community

- **License**: Apache 2.0. See [LICENSE](LICENSE).
- **Contributing**: Pull requests and issues welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for full release history and version updates.
