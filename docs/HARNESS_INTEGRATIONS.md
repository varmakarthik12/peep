# Harness Integration Guide

Peep is designed from the ground up to integrate seamlessly with modern agentic coding harnesses via the **Model Context Protocol (MCP)** or direct terminal execution.

This guide provides copy-paste ready setups for:
1. [Google Antigravity 2.0](#1-google-antigravity-20)
2. [Cursor](#2-cursor)
3. [Claude Code CLI & Claude Desktop](#3-claude-code-cli--claude-desktop)
4. [Windsurf Cascade](#4-windsurf-cascade)
5. [Cline & Roo Code](#5-cline--roo-code)
6. [GitHub Copilot (VS Code & JetBrains)](#6-github-copilot-vs-code--jetbrains)
7. [Troubleshooting Common Harness Issues](#7-troubleshooting-common-harness-issues)

---

## 1. Google Antigravity 2.0

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
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b",
        "PEEP_TARGET_TYPE": "android"
      }
    }
  }
}
```

> [!TIP]
> If running native Ollama without the `/v1` compatibility layer, set `"PEEP_PROVIDER_TYPE": "ollama"` and `"PEEP_BASE_URL": "http://localhost:11434"`.

### Step 2: Install Native Skill
Copy the ready-made skill definition into your Antigravity skills repository:

```bash
# Workspace level (Recommended for project repos):
mkdir -p .gemini/skills/peep-token-shield
cp configs/harnesses/antigravity/SKILL.md .gemini/skills/peep-token-shield/SKILL.md

# Or global user level:
mkdir -p ~/.gemini/antigravity/builtin/skills/peep-token-shield
cp configs/harnesses/antigravity/SKILL.md ~/.gemini/antigravity/builtin/skills/peep-token-shield/SKILL.md
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
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
      }
    }
  }
}
```

### Step 2: Install Cursor Rule
Copy the rule file to enable automatic token-shield delegation:

```bash
mkdir -p .cursor/rules
cp configs/harnesses/cursor/rules.mdc .cursor/rules/peep.mdc
```

Or for legacy `.cursorrules` users, append the content of `configs/harnesses/cursor/rules.mdc` to `.cursorrules`.

### Step 3: Example Cursor Prompt
In Cursor Chat (Ctrl+L / Cmd+L) or Composer (Ctrl+I / Cmd+I):
> *"Test the login flow on the connected Android device: tap Email, type 'dev@example.com', tap Password, type 'secret123', tap Sign In, and assert that the Dashboard welcome banner is visible."*

Cursor will route every step through Peep's calibrated coordinate engine and local VLM, keeping your Composer context feather-light.

---

## 3. Claude Code CLI & Claude Desktop

Anthropic's Claude Code and Claude Desktop can interact with Peep via MCP stdio.

### Claude Code CLI (Recommended)
Add Peep directly using the Claude CLI:

```bash
# Add to current project:
claude mcp add peep -- npx -y peep-mcp serve

# Or add with environment variables:
claude mcp add peep --env PEEP_BASE_URL=http://localhost:11434/v1 --env PEEP_VLM_MODEL=qwen2.5-vl:7b -- npx -y peep-mcp serve
```

Next, copy `CLAUDE.md` to your repository root:
```bash
cp configs/harnesses/claude/CLAUDE.md ./CLAUDE.md
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
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
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
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
      }
    }
  }
}
```

### Step 2: Install Windsurf Rules
Copy the rule template:
```bash
cp configs/harnesses/windsurf/windsurfrules.md .windsurfrules
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
        "PEEP_VLM_MODEL": "qwen2.5-vl:7b",
        "PEEP_SLM_MODEL": "gemma:2b"
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
        "peep_get_telemetry"
      ]
    }
  }
}
```

### Step 2: Add Custom Instructions
In the Cline/Roo Code settings UI, paste the contents of `configs/harnesses/cline_roocode/custom_instructions.md` into the **Custom Instructions** field.

---

## 6. GitHub Copilot (VS Code & JetBrains)

GitHub Copilot Chat and Copilot Workspace leverage instruction files to guide agentic tool usage and terminal commands.

### Step 1: Add Instruction File
Copy the Copilot instruction template to your repository:
```bash
mkdir -p .github
cp configs/harnesses/copilot/copilot-instructions.md .github/copilot-instructions.md
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

## 7. Troubleshooting Common Harness Issues

| Symptom | Probable Cause | One-Line Fix |
| :--- | :--- | :--- |
| **`spawn npx ENOENT`** | Node.js / npm not found in harness PATH | Specify the absolute path to `node` and `peep-mcp` or install globally: `npm install -g peep-mcp` and set `"command": "peep"`. |
| **`No Android devices connected`** | ADB daemon offline or device unauthorized | Run `adb devices` in terminal; ensure USB debugging prompt is accepted on phone/emulator. |
| **`fetch failed (ECONNREFUSED 11434)`** | Local inference engine (Ollama/vLLM) not running | Run `ollama serve` or ensure your Docker container is up on port 11434 / 8000. |
| **`VLM model 'qwen2.5-vl:7b' not found`** | Model hasn't been pulled yet | Run `ollama pull qwen2.5-vl:7b` in terminal. |
| **Harness hangs waiting for tool** | Stdio buffered or device command timed out | Check `peep doctor` output to confirm ADB and inference latencies are < 1000ms. |
