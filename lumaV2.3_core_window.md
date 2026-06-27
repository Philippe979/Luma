# Luma V2.3 Core Window Preview

## Product Shape

Luma V2.3 moves from a port-based butler UI to a full-screen personal agent workspace.

Main layout:

- Left sidebar: New chat, Projects, History Memory, Usage summary
- Right stage: Chat, Workshop, Memory
- No visible entry ports
- No status/weather/location surfaces

The old route/session fields stay as compatibility data for now, but the user-facing model is cluster-first.

## Memory Boundary

Profile Memory:

- affects Luma tone, pacing, formatting, and stable communication preferences
- does not act as raw conversation recall
- may be scoped globally or to a specific context

Cluster Memory:

- replaces user-selected ports as the future memory router
- should decide which project/history/workflow references are relevant
- is not fully active until retrieval scoring and safety rules are audited

History Memory:

- is shown as a global archive in the sidebar
- should eventually be titled and clustered automatically by LLM
- should not be injected into a fresh chat unless explicitly selected or retrieved by audited cluster logic

## Workshop Preview

Workshop is an editable background, not a hardcoded production-line management system.

The preview uses flexible blocks:

- station
- issue
- meeting
- cost
- reminder
- note
- custom block

Each block can carry:

- title
- stage
- attention level
- arbitrary fields
- notes

The Workshop chat panel demonstrates the intended process:

1. User describes a change or asks a question.
2. Luma reads the background.
3. Luma updates, highlights, or explains the background.
4. Later versions can convert this into confirmed backend actions.

Initial examples:

- "add a manual inspection station"
- "highlight bonding yield risk"
- "why does bonding station have poor yield"

## Implementation Status

Preview implemented:

- full-screen ChatGPT-style shell
- simplified sidebar
- global history list
- Workshop canvas
- local Workshop command mock
- Memory view remains available as architecture/status view

Not implemented yet:

- persisted Workshop backend schema
- LLM-powered Workshop action parser
- confirmed action workflow for Workshop edits
- cluster retrieval scoring
- automatic memory clustering
