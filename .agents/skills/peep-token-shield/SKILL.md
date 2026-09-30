---
name: peep-token-shield
description: Token-Shield for Android & UI interaction. Offloads visual perception, coordinate grounding, micro-loops, and noisy logcat analysis to local models (Ollama/llama.cpp/vLLM), saving 95-99% of cloud tokens. Use whenever automating mobile apps, running UI smoke tests, or investigating Android crashes.
---

# Peep Token-Shield Skill for Antigravity 2.0

You are equipped with **Peep**, an intelligent Token Shield and execution middleware designed to interact with mobile devices (Android via ADB/scrcpy) and system logs **without consuming expensive cloud vision or log tokens**.

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

## When to Use Peep Tools

### 1. Interacting with Screen Elements
- When you need to tap a button, text, or icon:
  Use `peep_find_and_tap(target="Submit Order", strategy="auto")`.
  - Strategy `auto` first tries the native accessibility tree (0ms, 0 tokens).
  - If not found or if the app is a custom Flutter/Canvas/Game view, it automatically falls back to local vision model grounding.
- When you need to type into a field:
  Use `peep_type_text(target="Email Address", text="user@example.com", clearFirst=true)`.

### 2. Scrolling & Navigation
- When you need to scroll up, down, left, or right:
  Use `peep_swipe(direction="up", distance="medium")`.
  *(Note: Swiping 'up' scrolls the content down).*
- For hardware keys:
  Use `peep_press_key(key="back")`, `peep_press_key(key="home")`, `peep_press_key(key="enter")`.

### 3. Visual Verification & Assertions
- When verifying that a screen reached the desired state (e.g. after form submission):
  Use `peep_assert_screen_state(expectedState="Order #1234 confirmation card is visible")`.
  - Returns `{ status: "PASS", confidence: 0.98, explanation: "..." }`.
  - Zero raw image tokens enter your context window!

### 4. Investigating Crashes & Log Analysis
- When an app crashes or after executing an action:
  Use `peep_tail_and_filter_logs(searchCrashes=true)`.
  - Peep filters thousands of lines of framework noise in memory.
  - A local model analyzes the crash stack and returns a concise 3-line diagnostic:
    `{ "hasFatalError": true, "culprit": "LoginActivity.kt:42", "summary": "NullPointerException on button click" }`.

### 5. Multi-Step Autonomous Flows
- When executing a multi-step routine (e.g. "Dismiss notifications dialog and navigate to Account Settings"):
  Use `peep_execute_goal(goal="...", maxSteps=6)`.
  - The local model executes the sub-loop locally.
  - You receive only the final outcome summary, saving 10,000+ tokens.

### 6. Tracking Token Savings
- Periodically or at the end of a testing session:
  Call `peep_get_telemetry()` to review total cloud tokens saved and USD cost savings.
