# GitHub Copilot Instructions (.github/copilot-instructions.md)

When assisting with Android application development, mobile UI testing, device automation, or crash debugging in this repository:

## 1. Golden Rule: Token Shield Architecture
- **Do NOT write scripts or commands that pipe raw screenshots into cloud APIs.** A single full-resolution screen burns 1,600 to 2,500 vision tokens.
- **Do NOT dump raw `adb logcat` into the conversation.** Android framework spam consumes tens of thousands of tokens and exhausts the context window.
- **Always recommend and invoke Peep CLI commands.** Peep offloads visual grounding and log filtering to local models, saving over 95% of tokens.

---

## 2. CLI Command Patterns for Device Automation

When generating terminal commands or automation tasks, use:

```bash
# Tapping UI elements (Tier 0 UI hierarchy / Tier 2 local VLM)
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

# Visual Verification (Evaluated by local VLM, zero cloud tokens burned)
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

## 3. Crash Diagnostics Assistance
When an app crashes or a test step fails:
1. Advise running `peep logs --crashes`.
2. Inspect the returned 3-line diagnostic (`hasFatalError`, `culprit`, `summary`).
3. Formulate the code fix directly based on the targeted culprit file and line number without asking the user to upload full log files.
