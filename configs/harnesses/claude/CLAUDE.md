# CLAUDE.md - Peep Token Shield for Claude Code

When working in repositories involving Android development, mobile testing, or device debugging:

## Philosophy: You Are the Principal Architect
- **NEVER capture raw screenshots into chat.** A single 1080×2400 screenshot consumes 1,600 to 2,500 vision tokens and clogs the context.
- **NEVER pipe raw `adb logcat` into chat.** Tailing logcat dumps 30,000+ noisy framework lines into context, causing "lost-in-the-middle" hallucinations.
- **ALWAYS delegate peripheral perception and log analysis to Peep.** Peep uses native UI trees and local models to execute actions locally and returns only compact JSON telemetry (~40 tokens).

---

## Core Command & Tool Guidelines

### 1. Interacting with Screen Elements
- **Tap an element**:
  - Via CLI: `peep tap "<target-description>"` (e.g. `peep tap "Sign In"`)
  - Via MCP: `peep_find_and_tap(target="Sign In", strategy="auto")`
  - *Note*: Strategy `auto` checks Android accessibility trees first (15ms, 0 tokens), falling back to local VLM vision grounding.

- **Type into fields**:
  - Via CLI: `peep type "<text>" --target "<field-name>"`
  - Via MCP: `peep_type_text(target="Email", text="test@example.com")`

### 2. Gestures & Navigation
- **Swipe / Scroll**:
  - Via CLI: `peep swipe <up|down|left|right> [--distance <short|medium|long>]`
  - Via MCP: `peep_swipe(direction="up", distance="medium")`
- **Hardware Keys**:
  - Via CLI: `peep press <back|home|enter|tab>`
  - Via MCP: `peep_press_key(key="back")`

### 3. Visual Assertions (Zero Cloud Vision Tokens)
- Verify screen state using local VLM:
  - Via CLI: `peep assert "<expected visual condition>"`
  - Via MCP: `peep_assert_screen_state(expectedState="Dashboard balance is visible")`

### 4. Crash & Error Diagnostics
- Check for crashes and fatal exceptions:
  - Via CLI: `peep logs --crashes`
  - Via MCP: `peep_tail_and_filter_logs(searchCrashes=true)`
  - *Returns a concise 3-line diagnostic without context pollution.*

### 5. Multi-Step Autonomous Sub-Loops
- Hand off multi-step UI flows:
  - Via CLI: `peep goal "<goal description>" --max-steps 8`
  - Via MCP: `peep_execute_goal(goal="Dismiss dialog and open Settings", maxSteps=8)`

### 6. Diagnostics & Token Telemetry
- Check system health: `peep doctor`
- Check cumulative token savings: `peep stats` or `peep_get_telemetry()`
