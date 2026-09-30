# GitHub Copilot Instructions (.github/copilot-instructions.md)

When assisting with Android application development, mobile UI testing, device automation, or crash debugging in this repository:

## 1. Golden Rule: Token Shield Architecture
- **Do NOT write scripts or commands that pipe raw screenshots into cloud APIs.** A single full-resolution screen burns 1,600 to 2,500 vision tokens.
- **Do NOT dump raw `adb logcat` into the conversation.** Android framework spam consumes tens of thousands of tokens and exhausts the context window.
- **Always recommend and invoke Peep CLI commands.** Peep offloads visual grounding and log filtering to local models, saving over 95% of tokens.

---

## 2. 🛑 Strict Engineering Rule: NEVER Call Raw ADB Shell Commands
- Do NOT run raw `adb logcat` (burns 30k-75k tokens per invocation). Use `peep logs --crashes`.
- Do NOT run raw `adb exec-out screencap` (burns 1,600-2,500 vision tokens). Use `peep tap` or `peep assert`.
- Do NOT run raw `adb shell input tap` (crash blind: returns exit code 0 even when app crashed). Peep's synchronized watchdog catches crashes immediately.
- Do NOT run raw `adb shell am start`. Use `peep launch` for automatic launcher activity resolution and startup crash checks.

---

## 3. CLI Command Patterns for Device Automation (v0.2.0)

When generating terminal commands or automation tasks, use:

```bash
# App Lifecycle & State
peep launch com.example.app/.MainActivity
peep stop com.example.app
peep clear com.example.app
peep install ./app-release.apk
peep state
peep wake
peep clipboard set "secret_token_123"
peep deeplink "myapp://checkout/confirmation"
peep apps --filter third_party

# Tapping UI elements (Tier 0 UI hierarchy / Tier 2 local vision)
peep tap "Login Button"
peep tap "Shopping Cart Icon"

# Typing text into fields
peep type "dev@example.com" --target "Email Address"
peep type "securePass123" --target "Password"

# Gestures and Navigation
peep swipe up --distance medium
peep swipe down --distance short
peep press back
peep press home

# Visual Verification (Evaluated by local vision model, zero cloud tokens burned)
peep assert "Order confirmation banner with ID #1234 is visible"
peep assert "Error dialog says 'Invalid Credentials'"

# Crash & Log Investigation
peep logs --crashes

# Autonomous Local Micro-Loops (Multi-step UI tasks)
peep goal "Dismiss system permission dialog and open Account Settings" --max-steps 6

# View Token & Cost Savings Telemetry
peep stats
```

---

## 4. Crash Diagnostics Assistance
When an app crashes or a test step fails:
1. Advise running `peep logs --crashes`.
2. Inspect the returned 3-line diagnostic (`hasFatalError`, `culprit`, `summary`).
3. Formulate the code fix directly based on the targeted culprit file and line number without asking the user to upload full log files.
