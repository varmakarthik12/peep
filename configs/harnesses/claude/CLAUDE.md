# CLAUDE.md - Peep Token Shield for Claude Code

When working in repositories involving Android development, mobile testing, or device debugging:

## Philosophy: You Are the Principal Architect
- **NEVER capture raw screenshots into chat.** A single 1080×2400 screenshot consumes 1,600 to 2,500 vision tokens and clogs the context.
- **NEVER pipe raw `adb logcat` into chat.** Tailing logcat dumps 30,000+ noisy framework lines into context, causing "lost-in-the-middle" hallucinations.
- **ALWAYS delegate peripheral perception, app lifecycle, and log analysis to Peep.** Peep uses native UI trees and local models to execute actions locally and returns only compact JSON telemetry (~40 tokens).

---

## 🛑 Strict Engineering Rule: NEVER Call Raw ADB Shell Commands

**Do NOT run raw ADB shell commands in bash or terminal sessions.**

1. **Context Flood**: `adb logcat` burns 30,000–75,000 tokens of GC/Choreographer spam. Use `peep logs --crashes` or `peep_tail_and_filter_logs` (~60 tokens).
2. **Vision Token Burn**: `adb exec-out screencap` uploads 1,600–2,500 tokens per frame. Use `peep_find_and_tap` (0 cloud vision tokens).
3. **Crash Blindness**: Raw `adb shell input tap` returns 0 even if the app crashed. Peep's synchronized crash watchdog flags crashes on every action.
4. **App Lifecycle Issues**: `adb shell am start` fails on activity mismatches. Use `peep launch` or `peep_launch_app` for auto launcher activity resolution.
5. **Windows Binary Stream Corruption**: Powershell CRLF mangles raw screenshot streams. Peep handles direct binary streams safely.

---

## Core Command & Tool Guidelines (v0.2.0)

### 1. App Lifecycle & OS Control
- **Launch app**: `peep launch <package>` or `peep_launch_app(app="com.example.app")`
- **Stop app**: `peep stop <package>` or `peep_stop_app(app="com.example.app")`
- **Clear app data**: `peep clear <package>` or `peep_clear_app_data(app="com.example.app")`
- **Install APK**: `peep install <path>` or `peep_install_app(path="path/to/app.apk")`
- **Device state**: `peep state` or `peep_get_device_state()`
- **Wake & unlock**: `peep wake` or `peep_wake_and_unlock()`
- **Clipboard**: `peep clipboard <set|get|paste>` or `peep_clipboard(action="set", text="...")`
- **Deep links**: `peep deeplink "<url>"` or `peep_open_deep_link(url="...")`
- **Permissions**: `peep perms <grant|revoke|list>` or `peep_manage_permissions(app="...", action="grant", permission="POST_NOTIFICATIONS")`
- **List installed apps**: `peep apps` or `peep_list_apps(filter="third_party")`

### 2. Screen Perception & Interaction
- **Locate without tapping**: `peep locate "<target>"` or `peep_locate_element(target="Save", strategy="auto")`
- **Visual screen analysis & scroll state**: `peep analyze [prompt]` or `peep_analyze_screen(prompt="...", focus="all|scroll_state")`
- **Tap an element**: `peep tap "<target>"` or `peep_find_and_tap(target="Sign In", strategy="auto")`
- **Type into fields**: `peep type "<text>" --target "<field>"` or `peep_type_text(target="Email", text="user@example.com")`
- **Swipe / Scroll**: `peep swipe <up|down|left|right>` or `peep_swipe(direction="up", distance="medium")`
- **Hardware keys**: `peep press <back|home|enter|tab>` or `peep_press_key(key="back")`

### 3. Visual Assertions (Zero Cloud Vision Tokens)
- Verify screen state: `peep assert "<condition>"` or `peep_assert_screen_state(expectedState="Order confirmation is visible")`

### 4. Crash & Error Diagnostics
- Check for crashes: `peep logs --crashes` or `peep_tail_and_filter_logs(searchCrashes=true)`

### 5. Multi-Step Autonomous Sub-Loops
- Hand off complex UI flows: `peep goal "<goal>" --max-steps 8` or `peep_execute_goal(goal="...", maxSteps=8)`

### 6. Diagnostics & Token Telemetry
- Check system health: `peep doctor`
- Check cumulative token savings: `peep stats` or `peep_get_telemetry()`
