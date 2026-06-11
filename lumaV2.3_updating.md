# Luma V2.3 Updating Notes

## V2.3.0 Output Runtime Foundation

Luma V2.3 starts by fixing the output layer before introducing workflow clusters.

The main problem from V2.2 was that one `response` field was doing too much:

- final answer
- assistant notice
- action proposal summary
- workflow feedback
- memory update confirmation

This caused Luma to answer content requests with transition phrases such as "I will generate it" instead of producing the actual result.

## First Implementation Scope

V2.3.0 focuses on:

- typed response metadata
- direct answer routing
- document-style Luma response rendering
- visible UI removal of status, weather, and location surfaces
- compatibility with existing backend status/context/reminder APIs

It intentionally does not implement:

- workflow clusters
- environment clusters
- Qwen as primary planner
- multi-model scoring
- backend deletion of old status/weather/location modules

## LLM Interaction Contract

Every Luma turn should move toward this structure:

```json
{
  "intent": "direct_answer | memory_action | workflow_task",
  "finalAnswer": "",
  "assistantNotice": "",
  "outputType": "chat | document | code | table | math",
  "workflowTrace": [],
  "proposedActions": []
}
```

For compatibility, `response` remains available and should resolve to:

```text
finalAnswer || assistantNotice || legacy response
```

## Routing Rules

Direct answer route:

- writing
- summarizing
- explaining
- translating
- listing
- analyzing
- report/essay/reference/method generation

Memory action route:

- remember
- save memory
- update project progress
- create reminder
- update explicit status

Qwen remains a background workflow learner in this stage.

## UI Direction

The user input remains chat-like.

Luma output becomes document-like:

- wider response canvas
- markdown headings
- bullet and numbered lists
- code blocks
- tables
- blockquotes
- long-form readable paragraphs

V2.3 hides old status/weather/location UI because workflow + cluster memory will replace the older context-first butler model.

## Compatibility Notes

The backend still keeps:

- `status.js`
- `context.js`
- reminder APIs
- status receipt fields

These remain for existing data and deployment safety. They should be retired only after workflow and environment cluster memory become stable.

## V2.3.1 Profile Memory and Output UX Debugging

V2.3.1 focuses on the first debugging pass after the output runtime foundation.

Implemented:

- compact `View Process` panel that stays collapsed until the user opens it
- front-end typewriter animation for newly generated assistant replies
- softer white + violet UI direction, replacing the older green/console tone
- `Profile Memory` scaffold for communication preferences and stable user style signals
- DeepSeek-based profile extraction endpoint that can convert older memory into compact, high-quality profile candidates
- manual `Extract Profile` control in the Memory / RAG panel
- reserved workflow cluster and environment cluster structures
- capability registry entries for profile memory and future cluster memory

Important architecture boundary:

- Profile Memory may affect Luma's tone, pacing, formatting, and communication style.
- Profile Memory must not be treated as raw conversation history.
- Profile Memory injection is scoped to `global` plus the current entry route, so route-specific relationship terms do not leak into other ports.
- Raw historical memory still requires explicit user selection or an explicit request.
- Workflow clusters and environment clusters are reserved but should not actively retrieve context until the cluster layer is audited.

This keeps daily communication preferences separate from task/workflow memory:

- daily communication -> profile memory
- task execution patterns -> workflow records/clusters
- deployment/device/context facts -> environment clusters

The goal is to restore a warmer and less mechanical Luma voice without reintroducing the old bug where unrelated memory appears inside a fresh session.
