# Windsurf Cascade Rule: Peep Token Shield (v0.2.0)

When executing mobile UI tests, interacting with Android devices, or debugging app crashes in Windsurf Cascade:

## 1. Token Shield Directives
- **Zero Raw Screenshots in Context**: Never request full base64 screenshots into the conversation. Let Peep resolve physical click coordinates and visual assertions via the local vision model.
- **Zero Logcat Flooding**: For crash analysis, call `peep_tail_and_filter_logs(searchCrashes=true)` or run `peep logs --crashes` to obtain a 3-line diagnostic without context degradation.
- **Compact Telemetry**: Each Peep action returns lightweight JSON (~40 tokens), preserving your Cascade context for architectural reasoning.

## 2. 🛑 Strict Engineering Rule: NEVER Call Raw ADB Shell Commands
- Do NOT run raw `adb logcat` (burns 30k-75k tokens per dump). Use `peep_tail_and_filter_logs` (~60 tokens).
- Do NOT run raw `adb exec-out screencap` (burns 1,600-2,500 vision tokens). Use `peep_find_and_tap` (0 cloud vision tokens).
- Do NOT run raw `adb shell input tap` (crash blind: returns exit code 0 even when app died). Peep's watchdog catches crashes synchronously.
- Do NOT run raw `adb shell am start`. Use `peep_launch_app` for auto launcher activity resolution.

## 3. MCP Tools Quick Reference (v0.2.0)
- `peep_launch_app`: Launch app with automatic launcher activity resolution & crash check.
- `peep_stop_app`: Force-stop app package.
- `peep_clear_app_data`: Factory reset app data & cache.
- `peep_install_app`: Install APK with auto-granted permissions.
- `peep_wake_and_unlock`: Turn on display & dismiss keyguard.
- `peep_get_device_state`: Foreground activity, screen metrics, battery state.
- `peep_clipboard`: Clipboard get, set, paste operations.
- `peep_open_deep_link`: Dispatch deep links and URLs.
- `peep_manage_permissions`: Grant/revoke app permissions.
- `peep_list_apps`: List installed packages.
- `peep_manage_files`: Push/pull files with media scanner broadcast.
- `peep_find_and_tap`: Locate element by label or local vision model and tap.
- `peep_type_text`: Input text with proper field focusing.
- `peep_swipe`: Smooth directional swiping (`up`, `down`, `left`, `right`).
- `peep_press_key`: Back, Home, Enter keys.
- `peep_assert_screen_state`: Verify UI state visually using local model without burning cloud tokens.
- `peep_tail_and_filter_logs`: Extract fatal crashes via local model or crash watchdog instead of reading raw logs.
- `peep_execute_goal`: Delegate multi-step UI flows to local autonomous micro-loop.
- `peep_get_telemetry`: Inspect cumulative tokens and dollar savings.

## 4. Terminal CLI Commands
When issuing bash commands in Cascade:
- `peep launch <package>`
- `peep stop <package>`
- `peep clear <package>`
- `peep state`
- `peep wake`
- `peep tap "<target>"`
- `peep type "<text>" --target "<field>"`
- `peep swipe <direction>`
- `peep assert "<condition>"`
- `peep logs --crashes`
- `peep stats`
