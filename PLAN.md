# AI Q&A UX And Saved Notes Plan

## Summary

Add a shared AI reference experience for DM and players: a progress/loading indicator while questions are in flight, a scrollable ephemeral conversation log that lasts until navigation/refresh, player-side rules-only Q&A, and saved common-question notes. Saved notes will persist in the database: DM notes belong to the campaign DM space; player notes belong to a specific `Player` record.

## Key Changes

- Frontend Q&A state:
  - Replace single `knowledgeChat` display with an in-memory `conversationLog` array containing `{ id, role/scope, question, response?, status, createdAt, error? }`.
  - On ask submit, append a pending log entry, show an animated progress bar, disable the ask button, then update the entry when the API returns or fails.
  - Render the log in a max-height scrollable panel and auto-scroll to the newest entry.
  - Keep the log only in React state, so it clears on navigation/refresh.

- DM reference UI:
  - Keep existing DM Reference panel behavior, but display responses as rolling conversation entries instead of replacing the previous answer.
  - Add a “Save note” action on completed AI answers.
  - Saved DM notes are campaign-scoped and visible only in the DM view.

- Player reference UI:
  - Add a Player Reference panel in `PlayerWorkspace`.
  - Players can ask rules-only questions using the same SRD/rules retrieval mode; no DM/homebrew/session-note sources are exposed.
  - Player asks use a public/player-safe endpoint and do not require the DM token.
  - Add a player selector or attach saved notes to the relevant character sheet card when saving; saved player notes belong to a `Player`.

- Persistence/API:
  - Add a Prisma model for saved AI notes with owner fields:
    - campaign id, optional player id, owner type `DM | PLAYER`, question, answer, source summary/references, createdAt.
  - Add DM endpoints for listing/creating/deleting campaign DM notes, guarded by `DmAuthGuard`.
  - Add player-safe endpoints for rules-only chat and player note list/create/delete by `playerId`.
  - Ensure player chat service path forces `RulesOnly` and filters to rules/SRD-style source types regardless of client input.

## Test Plan

- Unit tests:
  - DM chat still calls the local LLM and returns sources.
  - Player chat cannot retrieve Homebrew, SessionNotes, HouseRule, or other DM-private source types.
  - Saved note creation validates campaign/player ownership.
  - DM note endpoints reject missing/invalid DM tokens.

- Frontend behavior checks:
  - Asking a question immediately shows a pending log row and progress bar.
  - Progress bar stops and the row updates on success or error.
  - Multiple questions remain visible in a scrollable rolling log until refresh/navigation.
  - DM can save an answer as a campaign note.
  - Player can ask a rules-only question and save it to their selected player record.

- Manual acceptance:
  - DM Reference still works with existing imported SRD.
  - Player route can ask “rules only” questions without seeing DM-only source material.
  - Refreshing the page clears the ephemeral conversation log but saved notes remain.

## Assumptions

- “Accounts” means the app’s current ownership model: campaign DM space and `Player` records, not a new login/account system.
- Player AI access is rules-only by default.
- Conversation history is intentionally ephemeral and stored only in React state.
- A Docker rebuild is not part of this feature unless Prisma client generation/build artifacts need refreshing during implementation.
