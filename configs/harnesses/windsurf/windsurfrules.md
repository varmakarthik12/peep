# Windsurf Cascade Rule: Peep Token Shield

When executing mobile UI tests, interacting with Android devices, or debugging app crashes in Windsurf Cascade:

## 1. Token Shield Directives
- **Zero Raw Screenshots in Context**: Never request full base64 screenshots into the conversation. Let Peep resolve physical click coordinates and visual assertions via the local vision model.
- **Zero Logcat Flooding**: For crash analysis, call `peep_tail_and_filter_logs(searchCrashes=true)` or run `peep logs --crashes` to obtain a 3-line diagnostic without context degradation.
- **Compact Telemetry**: Each Peep action returns lightweight JSON (~40 tokens), preserving your Cascade context for architectural reasoning.

## 2. MCP Tools Quick Reference
- `peep_find_and_tap`: Locate element by label or local VLM vision and tap.
- `peep_type_text`: Input text with proper field focusing.
- `peep_swipe`: Smooth directional swiping (`up`, `down`, `left`, `right`).
- `peep_press_key`: Back, Home, Enter keys.
- `peep_assert_screen_state`: Verify UI state visually using local VLM without burning cloud tokens.
- `peep_tail_and_filter_logs`: Extract fatal crashes via local SLM instead of reading raw logs.
- `peep_execute_goal`: Delegate multi-step UI flows to local autonomous micro-loop.
- `peep_get_telemetry`: Inspect cumulative tokens and dollar savings.

## 3. Terminal CLI Commands
When issuing bash commands in Cascade:
- `peep tap "<target>"`
- `peep type "<text>" --target "<field>"`
- `peep swipe <direction>`
- `peep assert "<condition>"`
- `peep logs --crashes`
- `peep stats`
