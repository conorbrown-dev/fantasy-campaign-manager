Implement a local D&D 5e DM reference chatbot system for my existing application.

Context:
This is a private household app, not a commercial product. Its purpose is to help me learn to DM and run a family D&D 5e campaign. For now, assume I am the Dungeon Master. Kid-friendly tutor modes may be added later, but they are not part of this implementation.

Primary goal:
Add a local RAG-style reference system that can ingest legally usable D&D 5e SRD material and my own homebrew campaign notes, then answer DM questions using retrieved source context.

Important content/legal constraints:

* Do not include, scrape, or hardcode non-SRD copyrighted D&D book text.
* Do not scrape D&D Beyond paid content.
* Do not include official D&D art.
* Design the system so I can import the official SRD 5.1 Creative Commons PDF or extracted text locally.
* Include source metadata and attribution support for imported material.
* Keep source tracking on every imported chunk so answers can cite where the information came from.
* The system should be able to distinguish between rules/reference content and homebrew campaign content.

Functional requirements:

1. Source/document ingestion

   * Add a way to import local reference files and campaign files.
   * Support text-based formats first, such as `.txt`, `.md`, and `.json`.
   * PDF support is desirable, especially for SRD 5.1, but if full PDF support is not practical immediately, create a clean extension point for it and implement text/markdown import first.
   * Store document-level metadata:

     * document id
     * source name
     * source type
     * license/attribution info if provided
     * original file name
     * import date
     * content hash
   * Supported source types should include:

     * SRD
     * Open5e
     * FiveEBits
     * Homebrew
     * SessionNotes
     * CustomMonster
     * CustomSpell
     * HouseRule
   * Prevent duplicate imports when the same file/content is imported more than once.

2. Chunking

   * Split imported documents into searchable chunks.
   * Preserve useful source metadata on every chunk:

     * chunk id
     * source document id
     * source name
     * source type
     * title
     * section path
     * page number if available
     * chunk index
     * text
     * hash
   * Prefer section-aware chunking over arbitrary character splitting.
   * For markdown, use headings to preserve section structure.
   * For JSON, preserve meaningful entity boundaries such as individual monsters, spells, equipment entries, rule sections, or campaign notes.
   * Avoid duplicate chunks by hash.
   * Chunks should be large enough to preserve rule context but small enough to retrieve accurately.

3. Embedding and indexing

   * Generate embeddings for imported chunks.
   * Store/search embeddings using the app’s existing vector search approach.
   * Add a way to rebuild the search index.
   * Add a way to reindex a single document.
   * Track whether each document/chunk has been successfully indexed.
   * Handle failures gracefully if the local embedding service or vector search service is unavailable.

4. Retrieval

   * Given a user question, retrieve the most relevant source chunks.
   * Allow retrieval to be filtered by source mode:

     * All
     * RulesOnly
     * HomebrewOnly
     * RulesAndHomebrew
     * SessionNotesOnly
   * Return retrieved chunks with:

     * relevance score
     * source name
     * source type
     * title
     * section path
     * page number if available
     * text preview
   * If no useful context is found, the chat system should say so clearly rather than inventing rules.

5. Chat behavior

   * Add or update the chat flow so user questions are answered using retrieved context.
   * The assistant should be a DM reference assistant, not a player character and not a generic fantasy writer.
   * It should help with:

     * rules questions
     * condition explanations
     * combat procedure
     * spell/monster lookup
     * encounter preparation
     * adjudicating unclear player actions
     * homebrew campaign consistency
     * session prep
   * For rules questions, answers should be grounded in retrieved SRD/reference content.
   * For campaign questions, answers may use retrieved homebrew/session-note content.
   * When the answer includes both official/reference rules and homebrew suggestions, clearly separate them.
   * If the retrieved context is insufficient, say what could not be verified.
   * Do not invent official rules.
   * Do not claim something is official unless supported by retrieved reference content.
   * Give practical DM guidance when appropriate, but label it as a suggested ruling.

6. Chat response format
   Use this default response structure when applicable:

   * Direct Answer
   * Rules Basis
   * DM Ruling Suggestion
   * Example at the Table
   * Sources Used

   The response may omit irrelevant sections for simple lookups, but should always include source information when retrieved context was used.

7. Source display

   * Show the sources used for each answer.
   * Each source should display:

     * source name
     * source type
     * title/section
     * page number if available
     * relevance score if useful
   * Allow the user to expand/view the retrieved chunks behind an answer.
   * Make it clear when the answer is based on SRD/reference content versus homebrew content.

8. Direct search/browse

   * Add a way to search the imported knowledge base directly without asking the chat model.
   * Search results should show:

     * source name
     * source type
     * title
     * section path
     * text preview
     * relevance score
   * Allow filtering by source type.
   * Allow opening/viewing the full chunk or source section.

9. Source management

   * Add a way to view imported documents.
   * Show document status:

     * imported
     * chunked
     * indexed
     * failed
   * Show chunk count per document.
   * Allow reimporting/reprocessing a document.
   * Allow deleting a document and its related chunks/index entries.
   * Allow rebuilding the whole knowledge index.

10. Attribution support

* Add an Attribution or Sources page/section.
* Include a place to display attribution for SRD 5.1 and any other imported open sources.
* The attribution text should be editable/configurable rather than hardcoded only in UI.
* At minimum, support attribution text similar to:
  “This app includes material from the System Reference Document 5.1 (‘SRD 5.1’) by Wizards of the Coast LLC. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License.”
* Track attribution/license metadata per source document where possible.

11. Homebrew support

* Treat homebrew campaign material as first-class searchable content.
* Support importing campaign notes, NPCs, locations, monsters, spells, house rules, session summaries, and plot notes.
* Ensure homebrew material is clearly labeled as homebrew in search and chat answers.
* Allow the chat assistant to use homebrew material when the selected source mode allows it.
* Avoid mixing homebrew into rules answers unless clearly labeled.

12. Prompting
    Use a system prompt similar to this for the DM assistant:

“You are a private D&D 5e Dungeon Master reference assistant for a family campaign.

Your job is to help the DM understand rules, prepare sessions, adjudicate uncertain situations, and use the campaign’s homebrew material.

Rules:

1. When answering rules questions, use the provided retrieved reference context.
2. Clearly separate:

   * Rules-as-written / source-supported answer
   * Practical DM ruling suggestion
   * Homebrew/campaign-specific idea
3. If the retrieved context does not contain enough information, say: ‘I could not verify that from the provided sources.’
4. Do not invent official D&D rules.
5. Do not claim non-SRD material is official unless it appears in the retrieved context.
6. Keep answers practical for someone learning to DM.
7. Prefer examples using the current family campaign when homebrew context is provided.
8. Do not quote huge blocks of source text unless the user asks for exact wording.
9. Always include a ‘Sources Used’ section when sources are available.
10. If the question is about table judgment, give a confident but clearly labeled DM ruling suggestion.

Default answer format:

* Direct Answer
* Rules Basis
* DM Ruling Suggestion
* Example at the Table
* Sources Used”

13. Error handling

* If import fails, show a clear error.
* If chunking fails, show which document failed.
* If indexing fails, keep the document/chunks available but mark indexing as failed.
* If retrieval returns no relevant context, the assistant should not pretend it found rules.
* If the local model or embedding provider is unavailable, show a clear message.
* Log enough detail to troubleshoot ingestion, indexing, retrieval, and chat issues.

14. Testing/verification
    Add tests or verification steps for:

* importing a markdown rules document
* importing a homebrew note
* preventing duplicate imports
* chunking by headings
* indexing chunks
* retrieving relevant chunks for a question
* filtering by source mode
* constructing the chat prompt with retrieved context
* returning sources used in the chat response
* handling no-context answers correctly

15. Example seed content

* Include only placeholder/example content that is original or clearly safe.
* Do not include copied D&D book text.
* Provide a tiny sample homebrew note and a tiny sample rules-style markdown document for testing the import pipeline.
* Make clear in comments or documentation where I should place my own locally obtained SRD 5.1 text/PDF.

Implementation priority:

1. Document/source ingestion
2. Chunking with metadata
3. Embedding/indexing integration
4. Retrieval with source filters
5. DM chat flow using retrieved context
6. Source display in chat answers
7. Direct knowledge-base search
8. Source/document management
9. Attribution support
10. Tests/verification and documentation

Acceptance criteria:

* I can import SRD/reference text and homebrew notes.
* The system chunks, indexes, and retrieves relevant context.
* I can ask a DM rules question and receive an answer grounded in retrieved sources.
* I can ask a homebrew campaign question and receive an answer grounded in campaign notes.
* The answer clearly separates source-supported rules from suggested DM rulings.
* The answer shows which sources were used.
* The system does not invent official rules when no relevant source context is found.
* Imported sources can be viewed, reprocessed, searched, and attributed.
