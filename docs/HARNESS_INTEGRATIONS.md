# Harness Integration Guide

Peep is designed from the ground up to integrate seamlessly with modern agentic coding harnesses via the **Model Context Protocol (MCP)** or direct terminal execution.

This guide provides copy-paste ready setups for:
1. [Antigravity 2.0](#1-antigravity-20)
2. [Cursor](#2-cursor)
3. [Claude Code CLI & Claude Desktop](#3-claude-code-cli--claude-desktop)
4. [Windsurf Cascade](#4-windsurf-cascade)
5. [Cline & Roo Code](#5-cline--roo-code)
6. [GitHub Copilot (VS Code & JetBrains)](#6-github-copilot-vs-code--jetbrains)
7. [Strict Anti-Raw-ADB Directives](#7-strict-anti-raw-adb-directives)
8. [Troubleshooting Common Harness Issues](#8-troubleshooting-common-harness-issues)

---

## 1. Antigravity 2.0

Antigravity uses MCP servers defined in your global or project-level configuration, combined with Native Skills (`SKILL.md`) that teach the agent when to invoke the Token Shield.

### Step 1: Configure MCP Server
Add `peep` to your Antigravity MCP configuration.

**Configuration File Location:**
- **Windows**: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- **macOS / Linux**: `~/.gemini/antigravity/mcp_config.json`
- **Project-Level** (applies to workspace only): `.gemini/mcp_config.json` or `.agents/mcp_config.json`

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
> If running native Ollama without the `/v1` compatibility layer, set `"PEEP_PROVIDER_TYPE": "ollama"` and `"PEEP_BASE_URL": "http://localhost:11434"`.

### Step 2: Install Native Skill & /peep Slash Command
Download and install the native skill directly from GitHub:

**Project Workspace Level (Recommended — applies to current repository):**
- **macOS / Linux**:
  ```bash
  mkdir -p .agents/skills/peep && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md -o .agents/skills/peep/SKILL.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path ".agents\skills\peep"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md" -OutFile ".agents\skills\peep\SKILL.md"
  ```

**Global User Level (Enables `/peep` slash command across all workspaces):**
- **macOS / Linux**:
  ```bash
  mkdir -p ~/.gemini/antigravity/skills/peep && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md -o ~/.gemini/antigravity/skills/peep/SKILL.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path "$HOME\.gemini\antigravity\skills\peep"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/antigravity/SKILL.md" -OutFile "$HOME\.gemini\antigravity\skills\peep\SKILL.md"
  ```

### Step 3: Verify in Antigravity
Start an Antigravity prompt:
> *"Run doctor check on Peep and verify our Android emulator is connected."*

Antigravity will invoke `peep_find_and_tap` or check telemetry without ever loading heavy screenshots into your primary reasoning context.

---

## 2. Cursor

Cursor supports MCP servers natively in both project-level configurations and global settings, paired with Cursor Rules (`.cursor/rules/*.mdc`).

### Step 1: Add MCP Server
Create or edit `.cursor/mcp.json` in your repository root:

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

### Step 2: Install Cursor Rule (`.cursor/rules/peep.mdc`)
Download the rule file directly from GitHub into your project:

- **macOS / Linux**:
  ```bash
  mkdir -p .cursor/rules && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cursor/rules.mdc -o .cursor/rules/peep.mdc
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path ".cursor\rules"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cursor/rules.mdc" -OutFile ".cursor\rules\peep.mdc"
  ```

### Step 3: Example Cursor Prompt
In Cursor Chat (Ctrl+L / Cmd+L) or Composer (Ctrl+I / Cmd+I):
> *"Test the login flow on the connected Android device: tap Email, type 'dev@example.com', tap Password, type 'secret123', tap Sign In, and assert that the Dashboard welcome banner is visible."*

Cursor will route every step through Peep's calibrated coordinate engine and local VLM, keeping your Composer context feather-light.

---

## 3. Claude Code CLI & Claude Desktop

Claude Code CLI and Claude Desktop interact with Peep via standard MCP stdio.

### Claude Code CLI (Recommended)
Add Peep directly using the Claude CLI:

```bash
# Add to current project:
claude mcp add peep -- npx -y peep-mcp serve

# Or add with environment variables:
claude mcp add peep --env PEEP_BASE_URL=http://localhost:11434/v1 --env PEEP_MODEL=auto -- npx -y peep-mcp serve
```

Next, download project instructions (`CLAUDE.md`) directly from GitHub:
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/claude/CLAUDE.md -o CLAUDE.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/claude/CLAUDE.md" -OutFile "CLAUDE.md"
  ```

### Claude Desktop
Edit your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

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

---

## 4. Windsurf Cascade

Windsurf's Cascade agent natively supports MCP tool calling and system-level rules via `.windsurfrules`.

### Step 1: Add MCP Server
Edit `~/.codeium/windsurf/mcp_config.json` (or your project's `.windsurf/mcp_config.json`):

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

### Step 2: Install Windsurf Rules (`.windsurfrules`)
Download rules directly from GitHub into your project:
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/windsurf/windsurfrules.md -o .windsurfrules
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/windsurf/windsurfrules.md" -OutFile ".windsurfrules"
  ```

---

## 5. Cline & Roo Code

Cline and Roo Code for VS Code provide fine-grained auto-approval for MCP tools, allowing autonomous mobile test runs without constant manual confirmation prompts.

### Step 1: Configure MCP Settings
Open your Cline/Roo Code MCP Settings:
- **Windows**: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
  *(For Roo Code: `rooveterinaryinc.roo-cline\settings\mcp_settings.json`)*
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

Add the following:
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
      },
      "disabled": false,
      "autoApprove": [
        "peep_find_and_tap",
        "peep_type_text",
        "peep_swipe",
        "peep_press_key",
        "peep_assert_screen_state",
        "peep_tail_and_filter_logs",
        "peep_execute_goal",
        "peep_get_telemetry",
        "peep_launch_app",
        "peep_install_app",
        "peep_stop_app",
        "peep_clear_app_data",
        "peep_wake_and_unlock",
        "peep_clipboard",
        "peep_get_device_state",
        "peep_open_deep_link",
        "peep_manage_permissions",
        "peep_set_screen_orientation",
        "peep_manage_files",
        "peep_list_apps",
        "peep_browser_navigate",
        "peep_browser_get_distilled_dom",
        "peep_window_management"
      ]
    }
  }
}
```

### Step 2: Add Custom Instructions
Download custom instructions directly from GitHub:
- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cline_roocode/custom_instructions.md -o cline_peep_instructions.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/cline_roocode/custom_instructions.md" -OutFile "cline_peep_instructions.md"
  ```
Then paste the contents into the **Custom Instructions** field in Cline/Roo Code settings.

---

## 6. GitHub Copilot (VS Code & JetBrains)

GitHub Copilot Chat and Copilot Workspace leverage instruction files to guide agentic tool usage and terminal commands.

### Step 1: Install Instructions (`.github/copilot-instructions.md`)
Download the instructions directly from GitHub:
- **macOS / Linux**:
  ```bash
  mkdir -p .github && curl -fsSL https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/copilot/copilot-instructions.md -o .github/copilot-instructions.md
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType Directory -Force -Path ".github"; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/varmakarthik12/peep/main/configs/harnesses/copilot/copilot-instructions.md" -OutFile ".github\copilot-instructions.md"
  ```

### Step 2: Direct CLI Interaction
Because Copilot operates efficiently through integrated terminal execution, it will use direct CLI commands:
```bash
peep tap "Allow Permissions"
peep type "alice@example.com" --target "Email Address"
peep assert "Dashboard home is displayed"
peep logs --crashes
```

---

## 7. Strict Anti-Raw-ADB Directives

All harness instruction files (`SKILL.md`, `.cursor/rules/peep.mdc`, `CLAUDE.md`, `.windsurfrules`, `custom_instructions.md`, `copilot-instructions.md`) explicitly forbid coding agents from executing raw `adb` commands in terminal sessions.

### Why Every Harness Must Enforce Anti-Raw-ADB:
- **No Logcat Context Flooding**: Raw `adb logcat` floods chat context with 30,000–75,000 tokens of Choreographer and GC noise, quickly causing context saturation and forgetting earlier instructions.
- **No Heavy Screenshot Uploads**: Raw `adb exec-out screencap` burns 1,600–2,500 vision tokens per frame. Peep resolves elements locally with 0 cloud vision tokens.
- **Crash Detection Guarantee**: Raw `adb shell input tap` returns status 0 even when an app crashes or freezes. Peep's synchronized watchdog inspects the device synchronously on every tool call.
- **Reliable App Lifecycle**: `peep_launch_app` auto-resolves package launcher activities and checks startup health, avoiding common intent matching errors.
- **Windows Binary Stream Safety**: Prevents Windows PowerShell CRLF mangling from corrupting binary PNG screen transfers.

---

## 8. Troubleshooting Common Harness Issues

| Symptom | Probable Cause | One-Line Fix |
| :--- | :--- | :--- |
| **`spawn npx ENOENT`** | Node.js / npm not found in harness PATH | Specify the absolute path to `node` and `peep-mcp` or install globally: `npm install -g peep-mcp` and set `"command": "peep"`. |
| **`No Android devices connected`** | ADB daemon offline or device unauthorized | Run `npx peep-mcp devices`; ensure USB debugging prompt is accepted. See [Android Device Guide](ANDROID_DEVICE_GUIDE.md). |
| **`ADB hangs or times out`** | `adbPort` set to emulator port (e.g. 7555) instead of ADB daemon port (5037) | Leave `adbPort` as 5037 (or omit) and set `PEEP_DEVICE_ID="localhost:7555"`. See [Android Device Guide](ANDROID_DEVICE_GUIDE.md). |
| **`fetch failed (ECONNREFUSED 11434)`** | Local inference engine (Ollama/vLLM) not running | Run `ollama serve` or ensure your Docker container is up on port 11434 / 8000. |
| **`Specified model not found`** | Model hasn't been loaded on endpoint | Pull/load your model, or set `model: "auto"` to automatically bind to the running model. |
| **Harness hangs waiting for tool** | Stdio buffered or device command timed out | Check `peep doctor` output to confirm ADB and inference latencies are < 1000ms. |
