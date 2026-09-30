---
name: peep
description: Peripheral Evaluation & Execution Proxy (Peep). Offloads mobile & UI perception, taps, typing, gestures, visual assertions, micro-loops, and noisy logcat analysis to local models or deterministic accessibility trees, saving 95-99% of cloud tokens. Use whenever automating mobile apps, running UI smoke tests, or investigating device crashes.
---

# /peep - Peep Token-Shield for Antigravity 2.0

You are equipped with **Peep**, an intelligent Token Shield and execution proxy designed to interact with mobile devices (Android via ADB/scrcpy) and peripherals **without consuming expensive cloud vision or log tokens**.

---

## 🛑 Strict Engineering Rule: NEVER Call Raw ADB Shell Commands

**Do NOT fall back to running raw ADB commands in bash or powershell.**

### Why Raw ADB Is Forbidden:
1. **Catastrophic Token Burn:** Running raw `adb logcat -d` dumps 2,000–5,000 lines of Garbage Collection and Choreographer traces directly into context, burning **30,000–75,000 tokens per call**. Peep's `peep_tail_and_filter_logs` filters this noise in-memory and returns a clean 3-line diagnostic (~60 tokens).
2. **Vision Context Flooding:** Capturing screenshots via `adb exec-out screencap -p` and uploading them into cloud vision models burns **1,600–2,500 tokens per frame**. Peep's Tier 0 accessibility tree (0 tokens) and Tier 2 local VLM keep raw pixels entirely on the local machine.
3. **Crash Blindness (Silent Failure):** Raw commands like `adb shell input tap x y` return exit code `0` even if the app has suffered an ANR or `FATAL EXCEPTION`. You will tap blindly on a crash dialog without knowing the app died. Peep's synchronized crash watchdog detects crashes immediately on every interaction.
4. **Windows Binary Stream Corruption:** Running `adb exec-out screencap` through Windows PowerShell introduces CRLF translation (`0x0A` -> `0x0D 0x0A`), corrupting PNG headers and causing tool execution failures.
5. **Security & PII Leaks:** Raw ADB dumps OAuth tokens, session cookies, and user PII into third-party cloud prompt logs.

---

## Core Philosophy: You are the Principal Engineer
- **Do NOT request raw screenshots into your context.**
- **Do NOT tail raw `logcat` directly.**
- **Always invoke Peep tools as your primary execution proxy.** Peep delegates raw visual processing to your local multimodal model (or resolves it directly via native UI accessibility trees) and returns only lightweight, structured JSON telemetry.

---

## Slash Command Usage: `/peep <instruction>`

When the user invokes `/peep`, they want you to interact with or validate a peripheral device (Android phone, emulator, etc.) using Peep's token-shield tools:

- `/peep tap "<target>"`: Locate element (via Tier 0 accessibility tree or local vision) and tap it.
- `/peep type "<text>" in "<field>"`: Focus field and input sanitized text.
- `/peep swipe <direction>`: Dispatch directional swipe gesture (`up`, `down`, `left`, `right`).
- `/peep assert "<condition>"`: Visually verify that a condition is satisfied on screen without streaming images to cloud context.
- `/peep logs` or `/peep crashes`: Inspect recent logs, filter framework noise, and extract 3-line crash diagnostics.
- `/peep goal "<multi-step goal>"`: Hand off a multi-step routine to the local autonomous micro-loop.
- `/peep stats`: Retrieve cumulative session tokens and estimated dollar savings.
- `/peep devices`: Inspect connected Android devices/emulators and verify active device selection.

---

## Peep MCP Tools Reference

### 1. Interacting with Screen Elements
- **Tap a button, link, or icon:**
  `peep_find_and_tap(target="Submit Order", strategy="auto")`
  - Strategy `auto`: First queries native accessibility tree (~15ms, 0 tokens). If not found (e.g. Flutter/Canvas/Game view), falls back automatically to local VLM grounding.
  - Returns: `{ "status": "SUCCESS", "method": "tier0_semantic_tree", "tappedPoint": [540, 1200], "cloudTokensSaved": 1600 }`.
- **Type into an input field:**
  `peep_type_text(target="Email Address", text="user@example.com", clearFirst=true)`

### 2. Scrolling & Navigation
- **Scroll the viewport:**
  `peep_swipe(direction="up", distance="medium")`
  *(Note: Swiping 'up' scrolls the content down).*
- **Hardware & Navigation Keys:**
  `peep_press_key(key="back")`, `peep_press_key(key="home")`, `peep_press_key(key="enter")`

### 3. Visual Verification & Assertions
- **Verify expected screen state without cloud vision burn:**
  `peep_assert_screen_state(expectedState="Order confirmation card is visible")`
  - Evaluated locally by local VLM.
  - Returns: `{ "status": "PASS", "confidence": 0.98, "explanation": "Confirmation card with green checkmark is displayed." }`.
  - Zero raw image tokens enter cloud context!

### 4. Investigating Crashes & Log Analysis
- **Diagnose app stability:**
  `peep_tail_and_filter_logs(searchCrashes=true, limit=30)`
  - Automatically strips thousands of lines of framework noise in memory.
  - Produces a concise 3-line diagnostic:
    `{ "hasFatalError": true, "culprit": "CheckoutActivity.kt:84", "summary": "NullPointerException on button click" }`.

### 5. Multi-Step Autonomous Flows
- **Autonomous Micro-Loop:**
  `peep_execute_goal(goal="Dismiss permission popup and navigate to Profile Settings", maxSteps=6)`
  - The local model executes perception-action iterations locally on the machine.
  - Shields all intermediate screenshots, saving 10,000+ tokens per routine.

### 6. Tracking Telemetry & Savings
- **Review cumulative token savings:**
  `peep_get_telemetry()`
  - Returns total shielded actions, shielded screenshots, shielded log lines, and estimated USD cost savings.

---

## Multi-Target Platform Routing

Peep supports multiple targets enabled simultaneously (`defaultPlatform: "android"`):
- **`platform: "android"`** *(Production Ready)*: Connects to ADB devices & emulators (`localhost:7555`, `127.0.0.1:5555`, physical USB phones).
- **`platform: "browser"`** *(v0.2 Scaffold)*: Web automation adapter. If asked to test web apps, launch Chrome on the Android device and automate via `platform: "android"`.
- **`platform: "desktop"`** *(v0.2 Scaffold)*: Desktop OS window control adapter.
- **iOS Platform**: Planned roadmap for `xcrun simctl` (macOS simulators) and `go-ios` (physical devices).
