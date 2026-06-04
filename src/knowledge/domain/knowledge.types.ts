export const knowledgeSourceTypes = [
  "SRD",
  "Open5e",
  "FiveEBits",
  "Homebrew",
  "SessionNotes",
  "CustomMonster",
  "CustomSpell",
  "HouseRule",
] as const;

export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

export const retrievalModes = [
  "All",
  "RulesOnly",
  "HomebrewOnly",
  "RulesAndHomebrew",
  "SessionNotesOnly",
] as const;

export type RetrievalMode = (typeof retrievalModes)[number];

export type KnowledgeChunkInput = {
  title: string;
  sectionPath: string[];
  pageNumber?: number;
  text: string;
};

export type RetrievedKnowledgeChunk = {
  id: string;
  documentId: string;
  sourceName: string;
  sourceType: KnowledgeSourceType;
  title: string;
  sectionPath: string[];
  pageNumber?: number | null;
  text: string;
  textPreview: string;
  relevanceScore: number;
};
