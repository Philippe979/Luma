# Luma V2.2 Updating Plan

## Core Positioning

Luma V2.2 upgrades Luma from a conversation-first assistant into a portable workflow + chatbot agent runtime.

The goal is not to add more visible buttons or hardcoded features. The goal is to let Luma understand user intent, route memory, record workflow state, and call capability adapters when the task needs files, images, code, or other tools.

## Product Direction

Luma should remain simple from the user's point of view:

- Chat is the primary interaction surface.
- Usage/System is the operational surface.
- Files, images, and code enter through the chat input by drag-and-drop or attachment.
- Modes are not separate pages or buttons. Modes are backend capability units selected by Luma.

## UI Scope

The main navigation should be reduced to:

- Chat
- Usage/System

Chat is responsible for:

- conversation
- drag-and-drop file input
- session archive
- explicit memory/project context
- workflow trace display
- rich response rendering

Usage/System is responsible for:

- token usage
- DeepSeek and Qwen status
- capability registry status
- workflow history
- error logs
- RAG/memory index health
- recovery of soft-deleted items

## Capability Mode Principle

Mode = capability adapter, not a UI entrance.

Examples:

- file.read_pdf
- file.read_docx
- file.read_csv
- file.read_text
- code.read_file
- image.ocr_basic
- memory.rag_search
- workflow.record

Every capability should use a unified interface:

```json
{
  "name": "",
  "description": "",
  "input": {},
  "output": {},
  "permissions": [],
  "state": "available",
  "error": null
}
```

Adding a new function should mean:

1. Choose a mature open-source library or service.
2. Wrap it in a Luma adapter.
3. Register it in the capability registry.
4. Let the workflow planner select it when needed.

## V2.2 Read-First Scope

V2.2 focuses on reading and understanding, not complex generation.

Included in V2.2:

- read PDF
- read DOCX
- read CSV
- read TXT/Markdown
- read code files
- basic image OCR / image text extraction
- bind extracted content to session/project memory
- record workflow state
- prepare Qwen training samples from full task workflows

Deferred to V2.3:

- DOCX export
- PPTX export
- image generation
- code execution
- code modification
- browser/search automation
- email/calendar actions

## Memory and RAG

V2.2 introduces a formal RAG direction, but retrieval must remain scoped.

Memory records should include:

- sessionId
- projectId
- memoryType
- source
- state
- importance
- createdAt
- updatedAt
- deletedAt

Default behavior:

- Do not retrieve old memory automatically.
- Retrieve memory only when the user explicitly asks, when a project is active, or when a workflow requires it.
- Deleted memory must not be retrieved by RAG.

Memory layers:

- profile memory
- conversation memory
- project memory
- workflow memory
- capability/tool memory
- file memory

## Qwen Role

Qwen should not become the primary planner immediately.

Early V2.2 role:

- workflow learner
- shadow observer
- memory learner
- later-stage weak router

The real task flow should initially be completed by:

- user
- DeepSeek
- Luma state manager

Qwen learns the full workflow:

- initial user goal
- turn-by-turn changes
- DeepSeek responses
- accepted/rejected steps
- workflow evolution
- final result
- user feedback

After enough samples, Qwen can move into shadow planning before it is allowed to affect real execution.

## Workflow Trace

Luma should show execution workflow, not private model chain-of-thought.

Example visible workflow:

- Understanding request
- Detecting file
- Selecting capability
- Reading PDF
- Retrieving scoped memory
- Summarizing
- Waiting for confirmation
- Completed

Step states:

- pending
- running
- completed
- failed
- waiting

Each workflow step should be inspectable for debugging:

```json
{
  "id": "",
  "label": "",
  "capability": "",
  "state": "pending",
  "inputSummary": "",
  "outputSummary": "",
  "error": null
}
```

## Rich Response

Luma responses should support richer formatting than plain text.

V2.2 should support at least:

- bold
- italic
- bullet lists
- numbered lists
- quotes
- code blocks
- tables
- file cards
- workflow cards

The first implementation may use a safe Markdown subset. A later implementation can move to structured response blocks.

## Soft Delete

Memory, projects, sessions, files, and workflows should support soft delete.

Deletion should not physically remove records from the database.

Use lifecycle fields:

```json
{
  "state": "active",
  "archivedAt": null,
  "deletedAt": null,
  "deletedBy": null,
  "deleteReason": null
}
```

Rules:

- Default UI does not show deleted items.
- RAG does not retrieve deleted items.
- Qwen can learn that an item was deleted by the user.
- Usage/System can support recovery.
- Permanent purge is a separate maintenance/privacy action.

## Initial Implementation Order

1. UI version mark: V2.2.
2. Keep Chat and Usage/System as the target UI direction.
3. Add soft delete lifecycle for sessions/projects/memory.
4. Add delete controls for memory/project/session records.
5. Upgrade process trace into workflow trace.
6. Add rich response rendering.
7. Add capability registry.
8. Add drag-and-drop attachment entry.
9. Add read-only file capabilities.
10. Add scoped RAG memory schema.
11. Add Qwen workflow learning packet.

## Current Implementation Status

Implemented in the current V2.2 foundation:

- Chat + Usage/System navigation direction.
- Capability registry for file, code, image, memory, and workflow modes.
- Drag-and-drop / attach entry for chat file uploads.
- Read support for TXT, Markdown, CSV, JSON, HTML, CSS, JavaScript/TypeScript, Python, SQL, YAML, and similar text/code files.
- PDF and DOCX reader adapters are wired through `pdf-parse` and `mammoth`; deployment must run `npm install` after pulling this update.
- File memory is stored in `fileMemories` and linked to the active session/project.
- File upload creates a visible workflow trace and a session message.
- Soft delete lifecycle is available for memory, projects, and sessions.
- Usage/System shows capability mode status and scoped RAG/memory state.

Still planned:

- Image OCR adapter.
- True vector RAG index.
- Export/generation modes.
- Code execution or code modification.

## One-Line Summary

Luma V2.2 lets Luma read the world through chat, organize memory with scoped RAG, record visible workflows, and teach Qwen how real user tasks evolve over time.
