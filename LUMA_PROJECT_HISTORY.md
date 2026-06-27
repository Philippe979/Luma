# Luma Project History and Handoff

This file is a portable memory note for continuing Luma development across machines.
It records the major decisions, deployment shape, debugging history, and next steps from the Luma V2.0-V2.3 development cycle.

## Current Position

Luma is a personal agent runtime, not just a chatbot.

The current direction is:

- Main Luma UI: clean ChatGPT-like conversation surface.
- Workshop: editable production-line background that Luma can read, edit, highlight, and reason over.
- Memory: moving from simple chat memory toward profile memory plus cluster memory.
- LLM routing: DeepSeek is the main response model for now; Qwen is intended to learn workflows and memory patterns rather than answer directly.
- Local files: support has started for reading and editing local workspace files such as CSV, Excel, Word, and PowerPoint.
- Deployment: cloud server runs Luma frontend/backend/memory; local machine can expose Qwen through Cloudflare Tunnel.

## Important Architecture Decisions

### Luma Core

Luma should handle:

- user intent routing
- memory routing
- workflow planning
- capability selection
- state management
- user preference retrieval

Heavy execution should be delegated to function modes, external APIs, or specialized models.

### Memory Architecture

The long-term design is:

- Profile Memory: communication preferences, tone, personal style, language habits, high-quality extracted preferences.
- Conversation Memory: short-term session context.
- Project Memory: longer project records and progress.
- Cluster Memory: workflow/task-specific memory clusters with clear boundaries.
- Environment Cluster: local/cloud/workshop/runtime context and available capabilities.

Important rule:

- Luma should not randomly recall old memory into a fresh chat.
- Memory should be used only when the user selects it, when the session is explicitly linked, or when cluster routing later makes the boundary clear.
- Profile memory can influence tone and communication style.
- Cluster memory should influence workflow and task execution.

### Qwen Role

Qwen is not currently intended to be the primary response model.

Current intended role:

- learn from completed user + DeepSeek workflows
- summarize workflow patterns
- support later workflow planning
- help cluster memory evolve after high-quality information is extracted

Avoid letting Qwen generate important final answers too early, because it does not yet have enough high-quality workflow memory.

### Multi-Model Direction

The desired routing pattern is:

- Manual: user picks the model.
- Compare: multiple LLMs answer side by side.
- Review: one model reviews or synthesizes another model's answer.

Eventually, Luma should learn human preference and choose the best model automatically.

## Deployment History

### Aliyun Server

Server path:

```bash
/opt/Luma
```

Luma is managed by PM2:

```bash
pm2 status
pm2 restart luma --update-env
```

Common update flow when the server is not a git repo:

```bash
cd /opt
rm -f Luma-main.zip
curl -L --connect-timeout 60 --retry 10 --retry-delay 5 -o Luma-main.zip https://github.com/Philippe979/Luma/archive/refs/heads/main.zip
rm -rf Luma-main
unzip -o Luma-main.zip
cp /opt/Luma/.env /opt/Luma-main/.env
mv Luma Luma_backup_$(date +%Y%m%d_%H%M%S)
mv Luma-main Luma
cd /opt/Luma
npm install
npm run check
pm2 restart luma --update-env
pm2 status
```

Known GitHub issue:

- The Aliyun server sometimes fails to connect to GitHub through git or curl.
- Retrying with longer timeout usually works.
- Zip deployment has been more reliable than git pull on that server.

### Local Qwen

Local Qwen was exposed through Cloudflare Tunnel:

```text
qwen.philippegroup.uk -> http://127.0.0.1:11434
```

Test endpoint:

```powershell
Invoke-RestMethod https://qwen.philippegroup.uk/v1/models
```

Expected model at the time:

```text
qwen3.5:2b
```

## Major Debugging History

### V2.1 Debugging

Major issue:

- Fresh sessions could unexpectedly recall previous memory.

Decision:

- Fresh chat should not proactively call historical memory.
- Memory should be archived and selectable.
- Completed projects should not trap the user in the same project forever.

### V2.2 Direction

Major additions:

- File reading mode.
- Soft delete for sessions/projects/memory.
- Workflow/process visibility.
- More flexible Luma output with markdown-like structure.
- Capability/mode foundation.
- Local file workspace foundation.

Important design principle:

- Mode should be a capability unit, not a fixed UI button for every function.

### V2.3 Direction

Major direction:

- ChatGPT-like main UI.
- Remove old status/weather/location logic from the main design.
- Introduce profile memory and cluster memory framework.
- Add workshop as an editable background.
- Production-line map becomes the core workshop surface.
- Workshop should be controlled both manually and through Luma.

### Recent Bugs Fixed

#### Workshop messages polluted main chat

Root cause:

- Workshop command center called the same `/api/chat/propose` endpoint as main chat.
- Backend persisted those messages into the active main session.

Fix:

- Workshop requests now send `persistConversation: false`.
- Backend skips normal conversation persistence for workshop surface context.

#### New chat did not feel new

Root cause:

- Fresh session logic reused an existing empty session.

Fix:

- New chat now passes `forceNew: true`.
- Backend `activateFreshSession` supports forced creation.

#### Workshop Luma answer did not update map

Root cause:

- Workshop command center received a Luma answer but did not apply local map/attention mutations unless API failed.

Fix:

- Workshop command intent now silently applies local mutations after successful Luma response.
- Chinese and mixed Chinese-English commands were added to workshop command detection.

## Current Known UX Issue

Workshop command history is too chat-like and takes too much vertical space.

Desired behavior:

- Keep history, but display only compact one-line activity summaries.
- Example:

```text
Created wim station · UPH risk
Highlighted Bonding station
Removed Functional test station
```

- Click a row to expand full original text and Luma explanation.
- Refresh should default back to collapsed summaries.
- This should become Workshop Activity History, not a second chat transcript.

## Current GitHub State

Latest known pushed commit:

```text
16f783c Fix workshop session isolation and map sync
```

It was pushed to:

```text
origin/main
origin/deploy-chat-async
```

Local working branch:

```text
deploy-chat-async
```

## Development Notes

Local repo path on the old Windows machine:

```text
E:\Luma\Luma
```

Portable Node path:

```text
E:\Luma\nodejs
```

Run local check:

```powershell
$env:Path='E:\Luma\nodejs;' + $env:Path
E:\Luma\nodejs\npm.cmd run check
```

Known local Git issue:

- `.git/index.lock` sometimes remains after git operations on Windows.
- If no git process is running, remove the stale lock:

```powershell
Remove-Item -LiteralPath .git\index.lock
```

## Next Suggested Work

1. Convert Workshop command log into compact activity history.
2. Make each activity expandable.
3. Keep Workshop map and attention list synchronized.
4. Continue cluster memory framework, but keep it disabled or conservative until stable.
5. Improve profile memory extraction from high-quality interactions.
6. Continue local file editing support with explicit permission boundaries.
7. Keep main chat and Workshop surfaces isolated unless the user explicitly asks to connect them.

## Important Product Philosophy

Luma should feel like a portable personal agent runtime:

- clean enough to chat with
- structured enough to run workflows
- memory-driven but not memory-invasive
- able to edit visible backgrounds like Workshop
- able to learn user preference through high-quality extracted memories
- strict about cluster boundaries

The key risk is not lack of features.
The key risk is unclear memory boundaries.

