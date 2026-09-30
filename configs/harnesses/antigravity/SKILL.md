---
name: peep
description: Peripheral Evaluation & Execution Proxy (Peep). Offloads mobile & UI perception, taps, typing, gestures, visual assertions, micro-loops, app lifecycle, and noisy logcat analysis to local models or deterministic accessibility trees, saving 95-99% of cloud tokens. Use whenever automating mobile apps, running UI smoke tests, or investigating device crashes.
---

# /peep - Peep Token-Shield for Frontier Models & Antigravity 2.0

You are equipped with **Peep**, an intelligent Token Shield and execution proxy designed to interact with mobile devices (Android via ADB/scrcpy, iOS), browsers, and desktop peripherals **without consuming expensive cloud vision or log tokens**.

---

## 🛑 Strict Engineering Rule: NEVER Call Raw ADB Shell Commands

**Do NOT fall back to running raw ADB commands in bash or powershell.**

### Why Raw ADB Is Strictly Forbidden:
1. **Catastrophic Token Burn:** Running raw `adb logcat -d` dumps 2,000–5,000 lines of Garbage Collection and Choreographer traces directly into context, burning **30,000–75,000 tokens per call**. Peep's `peep_tail_and_filter_logs` filters this noise in-memory and returns a clean 3-line diagnostic (~60 tokens).
2. **Vision Context Flooding:** Capturing screenshots via `adb exec-out screencap -p` and uploading them into cloud vision models burns **1,600–2,500 tokens per frame**. Peep's Tier 0 accessibility tree (0 tokens) and Tier 2 local VLM keep raw pixels entirely on the local machine.
3. **Crash Blindness (Silent Failure):** Raw commands like `adb shell input tap x y` return exit code `0` even if the app has suffered an ANR or `FATAL EXCEPTION`. You will tap blindly on a crash dialog without knowing the app died. Peep's synchronized crash watchdog detects crashes immediately on every interaction.
4. **App Lifecycle Guesswork:** Commands like `adb shell am start` suffer from activity resolution failures and multi-activity matching conflicts. Peep's `peep_launch_app` auto-resolves launcher activities, checks startup crashes synchronously, and records latency.
5. **Windows Binary Stream Corruption:** Running `adb exec-out screencap` through Windows PowerShell introduces CRLF translation (`0x0A` -> `0x0D 0x0A`), corrupting PNG headers and causing tool execution failures.
6. **Security & PII Leaks:** Raw ADB dumps OAuth tokens, session cookies, and user PII into third-party cloud prompt logs.

---

## Core Philosophy: You are the Principal Engineer
- **Do NOT request raw screenshots into your context.**
- **Do NOT tail raw `logcat` directly.**
- **Always invoke Peep tools as your primary execution proxy.** Peep delegates raw visual processing to your local multimodal model (or resolves it directly via native UI accessibility trees) and returns only lightweight, structured JSON telemetry.

---

## Slash Command Usage: `/peep <instruction>`

When the user invokes `/peep`, they want you to interact with or validate a peripheral device (Android phone, emulator, browser, desktop) using Peep's token-shield tools:

- `/peep launch <app>`: Launch app with automatic activity resolution and synchronous startup crash detection.
- `/peep stop <app>`: Force stop an app process.
- `/peep clear <app>`: Reset app data and cache to factory state.
- `/peep state`: Inspect current foreground package/activity, screen resolution, orientation, and battery status.
- `/peep wake`: Wake screen and dismiss keyguard.
- `/peep tap "<target>"`: Locate element (via Tier 0 accessibility tree or local vision) and tap it.
- `/peep type "<text>" in "<field>"`: Focus field and input sanitized text.
- `/peep swipe <direction>`: Dispatch directional swipe gesture (`up`, `down`, `left`, `right`).
- `/peep clipboard <set|get|paste>`: Safe clipboard operations avoiding character-by-character shell escaping.
- `/peep deeplink "<url>"`: Dispatch deep link URI / scheme.
- `/peep apps`: List installed packages.
- `/peep assert "<condition>"`: Visually verify that a condition is satisfied on screen without streaming images to cloud context.
- `/peep logs` or `/peep crashes`: Inspect recent logs, filter framework noise, and extract 3-line crash diagnostics.
- `/peep goal "<multi-step goal>"`: Hand off a multi-step routine to the local autonomous micro-loop.
- `/peep stats`: Retrieve cumulative session tokens and estimated dollar savings.
- `/peep devices`: Inspect connected Android devices/emulators.

---

## Complete Peep MCP Tools Reference (v0.2.0)

### 1. App Lifecycle & System State
- **`peep_launch_app(app, stopExisting?, resetState?, waitForLaunch?, extras?)`**:
  Launches application by package or component. Auto-resolves launcher activity if omitted, checks crash watchdog immediately after launch, and returns cold/warm start latency.
- **`peep_stop_app(app)`**:
  Force-stops application process cleanly.
- **`peep_clear_app_data(app)`**:
  Clears all user data, SQLite databases, and cache for an application.
- **`peep_install_app(path, grantPermissions?, reinstall?, allowDowngrade?)`**:
  Installs local APK file onto the target device with auto-permission grant (`-g`).
- **`peep_wake_and_unlock(pin?)`**:
  Ensures screen is turned on and dismisses lockscreen/keyguard.
- **`peep_get_device_state()`**:
  Returns current foreground package/activity, display metrics, battery level, and charging status.
- **`peep_set_screen_orientation(orientation)`**:
  Sets screen orientation to `portrait`, `landscape`, or `auto`.
- **`peep_open_deep_link(url, app?)`**:
  Dispatches deep link / universal link intent to target app or browser.
- **`peep_manage_permissions(app, action, permission?)`**:
  `grant`, `revoke`, or `list` runtime Android permissions (e.g. `POST_NOTIFICATIONS`, `CAMERA`).
- **`peep_list_apps(filter?, search?, limit?)`**:
  Lists installed applications with filtering (`third_party`, `system`, `all`).
- **`peep_manage_files(action, devicePath, hostPath?)`**:
  Pushes, pulls, or deletes files between host and device with automatic media scanner broadcast.
- **`peep_clipboard(action, text?)`**:
  Reliably `set`, `get`, or `paste` clipboard contents without shell escaping issues.

### 2. Screen Perception & Interaction
- **`peep_find_and_tap(target, strategy?, context?, platform?)`**:
  Locates element (Tier 0 accessibility tree or Tier 2 local VLM) and executes physical tap. Shields 1,600+ vision tokens.
- **`peep_type_text(text, target?, clearFirst?, platform?)`**:
  Types text into active input field.
- **`peep_swipe(direction, distance?, platform?)`**:
  Smooth directional swipe gesture (`up`, `down`, `left`, `right`).
- **`peep_press_key(key, platform?)`**:
  Dispatches navigation key (`back`, `home`, `enter`, `tab`, `volume_up`, `volume_down`).

### 3. Visual Verification & Logs
- **`peep_assert_screen_state(expectedState, platform?)`**:
  Local model visual verification of expected UI condition. Zero tokens to cloud context.
- **`peep_tail_and_filter_logs(searchCrashes?, filterPattern?, limit?)`**:
  In-memory noise-filtered logs with 3-line crash diagnostics.
- **`peep_execute_goal(goal, maxSteps?, platform?)`**:
  Autonomous local micro-loop handoff. Shields all intermediate screenshot tokens.
- **`peep_get_telemetry()`**:
  Session token shield telemetry and dollar savings.

### 4. Browser & Desktop Targets (v0.2.0)
- **`peep_browser_navigate(url, waitForLoad?, timeoutMs?)`**:
  Navigates Playwright headless Chromium or Android Chrome to web URL.
- **`peep_browser_get_distilled_dom(selector?, maxDepth?)`**:
  Extracts distilled semantic DOM tree (interactive landmarks and reference IDs only), saving 95%+ of raw HTML tokens.
- **`peep_window_management(action, title?)`**:
  Desktop window management (`list`, `focus`, `get_metrics`).
