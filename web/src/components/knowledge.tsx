import { useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  KnowledgeChatResponse,
  KnowledgeDocument,
  KnowledgeSource,
  PendingLookup,
} from "../domain";
import { pendingIds, retrievalModes, sourceTypes } from "../domain";
import { apiUrl } from "../api";
import {
  BusyButtonContent,
  Field,
  SelectField,
  ToggleButtonField,
} from "./common";

const bundledSrdPageCount = 403;
const srdPageWindowSize = 6;

export function KnowledgePanel({
  isPending,
  campaignSlug,
  theme,
  documents,
  results,
  chat,
  onImport,
  onImportBundledSrd,
  onSearch,
  onAsk,
  onReindex,
  onDelete,
}: {
  isPending: PendingLookup;
  campaignSlug: string;
  theme: Record<string, string>;
  documents: KnowledgeDocument[];
  results: KnowledgeSource[];
  chat: KnowledgeChatResponse | null;
  onImport: (event: FormEvent<HTMLFormElement>) => void;
  onImportBundledSrd: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onAsk: (event: FormEvent<HTMLFormElement>) => void;
  onReindex: (documentId?: string) => void;
  onDelete: (documentId: string) => void;
}) {
  const askLoading = isPending(pendingIds.askKnowledge);
  const searchLoading = isPending(pendingIds.searchKnowledge);
  const importLoading = isPending(pendingIds.importKnowledge);
  const importSrdLoading = isPending(pendingIds.importBundledSrd);
  const rebuildLoading = isPending(pendingIds.reindexKnowledge());
  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-pixel text-xs leading-5">
          <BookOpen className="h-4 w-4" />
          SRD Rulebook
        </h2>
        <button
          type="button"
          className={`pixel-button grid h-9 w-9 place-items-center ${theme.button}`}
          onClick={() => onReindex()}
          title="Rebuild index"
          disabled={rebuildLoading}
        >
          {rebuildLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <form
        onSubmit={onAsk}
        className="mb-3 grid gap-2 lg:grid-cols-[1fr_150px_auto_auto]"
      >
        <Field label="Find a rule" name="question" compact />
        <SelectField
          label="Mode"
          name="mode"
          options={retrievalModes}
          defaultValue="RulesOnly"
          compact
        />
        <ToggleButtonField
          name="wholeWords"
          label="Whole Words"
          title="Match search terms as complete words"
          compact
        />
        <button
          className={`pixel-button mt-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-black lg:mt-6 ${theme.button}`}
          disabled={askLoading}
        >
          <BusyButtonContent
            loading={askLoading}
            loadingLabel="Finding..."
            icon={<BookOpen className="h-4 w-4" />}
          >
            Find Rule
          </BusyButtonContent>
        </button>
      </form>

      {chat ? (
        <div className="mb-3 max-h-[52vh] overflow-auto border-2 border-black bg-[#f8f4e8] p-3 text-black">
          <p className="mb-2 text-xs font-black uppercase">SRD source lookup</p>
          <pre className="whitespace-pre-wrap text-sm font-semibold leading-6">
            {chat.answer}
          </pre>
          {chat.retrievedChunks.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-black">
                Retrieved chunks
              </summary>
              <div className="mt-2 grid gap-2">
                {chat.retrievedChunks.map((chunk) => (
                  <SourceResult key={chunk.id} result={chunk} showFullText />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="mb-3 border-2 border-black bg-[#f8f4e8] p-3 text-sm font-bold text-black">
          Search the imported SRD for a rule and its source passages. Results
          are retrieved directly from the rulebook; no AI model is required.
        </div>
      )}

      <details className="mb-3 border-2 border-black bg-white/85 p-3 text-black">
        <summary className="cursor-pointer font-black">
          Search imported sources
        </summary>
        <form onSubmit={onSearch} className="mt-3 grid gap-2">
          <Field label="Search" name="q" compact />
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <SelectField
              label="Mode"
              name="mode"
              options={retrievalModes}
              defaultValue="RulesOnly"
              compact
            />
            <SelectField
              label="Source filter"
              name="sourceType"
              options={[
                "SRD",
                "",
                ...sourceTypes.filter((type) => type !== "SRD"),
              ]}
              defaultValue="SRD"
              optionLabel={(value) => value || "Any"}
              compact
            />
            <ToggleButtonField
              name="wholeWords"
              label="Whole Words"
              title="Match search terms as complete words"
              compact
            />
          </div>
          <button
            className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
            disabled={searchLoading}
          >
            <BusyButtonContent
              loading={searchLoading}
              loadingLabel="Searching..."
              icon={<Search className="h-4 w-4" />}
            >
              Search
            </BusyButtonContent>
          </button>
        </form>

        <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
          {results.map((result) => (
            <SourceResult key={result.id} result={result} />
          ))}
        </div>
      </details>

      <SrdPageViewer campaignSlug={campaignSlug} theme={theme} />

      <details className="border-2 border-black bg-white/85 p-3 text-black">
        <summary className="cursor-pointer font-black">
          <FileText className="h-4 w-4" />
          Sources ({documents.length})
        </summary>

        <form onSubmit={onImport} className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Source name" name="sourceName" compact />
            <SelectField
              label="Source type"
              name="sourceType"
              options={sourceTypes}
              compact
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label="License"
              name="licenseText"
              required={false}
              compact
            />
            <Field
              label="Attribution"
              name="attributionText"
              required={false}
              compact
            />
          </div>
          <input
            name="file"
            type="file"
            accept=".txt,.md,.markdown,.json,.pdf,text/plain,application/json"
            className="w-full border-2 border-black bg-white p-2 text-sm"
            required
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
              disabled={importLoading}
            >
              <BusyButtonContent
                loading={importLoading}
                loadingLabel="Importing..."
                icon={<Upload className="h-4 w-4" />}
              >
                Import
              </BusyButtonContent>
            </button>
            <button
              type="button"
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
              onClick={onImportBundledSrd}
              disabled={importSrdLoading}
            >
              <BusyButtonContent
                loading={importSrdLoading}
                loadingLabel="Importing SRD..."
                icon={<BookOpen className="h-4 w-4" />}
              >
                Import SRD
              </BusyButtonContent>
            </button>
          </div>
        </form>

        <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
          {documents.map((document) => (
            <div
              key={document.id}
              className="border-2 border-black bg-white p-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{document.sourceName}</p>
                  <p className="text-xs uppercase">
                    {document.sourceType} - {document.status} -{" "}
                    {document.chunkCount} chunks
                  </p>
                </div>
                <div className="flex gap-1">
                  {(() => {
                    const loading = isPending(
                      pendingIds.reindexKnowledge(document.id),
                    );
                    return (
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center border-2 border-black bg-[#bff3df]"
                        onClick={() => onReindex(document.id)}
                        title="Reindex source"
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    );
                  })()}
                  {(() => {
                    const loading = isPending(
                      pendingIds.deleteKnowledge(document.id),
                    );
                    return (
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center border-2 border-black bg-[#ffd1dc]"
                        onClick={() => onDelete(document.id)}
                        title="Delete source"
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
              <p className="mt-1 break-words text-xs">
                {document.originalFileName}
              </p>
              {document.attributionText ? (
                <p className="mt-2 text-xs">{document.attributionText}</p>
              ) : null}
              {document.errorMessage ? (
                <p className="mt-2 text-xs font-bold text-[#8a1f1f]">
                  {document.errorMessage}
                </p>
              ) : null}
            </div>
          ))}
          {!documents.length ? (
            <p className="border-2 border-black bg-white p-3 text-sm font-bold">
              No sources imported yet.
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function SrdPageViewer({
  campaignSlug,
  theme,
}: {
  campaignSlug: string;
  theme: Record<string, string>;
}) {
  const [startPage, setStartPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const pageNumbers = useMemo(
    () =>
      Array.from(
        {
          length: Math.min(
            srdPageWindowSize,
            bundledSrdPageCount - startPage + 1,
          ),
        },
        (_, index) => startPage + index,
      ),
    [startPage],
  );

  function clampPage(page: number) {
    return Math.min(Math.max(Math.trunc(page), 1), bundledSrdPageCount);
  }

  function goToPage(page: number) {
    const nextPage = clampPage(page);
    setStartPage(nextPage);
    setPageInput(String(nextPage));
  }

  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToPage(Number(pageInput));
  }

  return (
    <details className="mb-3 border-2 border-black bg-white/85 p-3 text-black">
      <summary className="cursor-pointer font-black">
        <BookOpen className="h-4 w-4" />
        SRD Page Viewer
      </summary>

      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
            onClick={() => goToPage(startPage - srdPageWindowSize)}
            disabled={startPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <form onSubmit={jumpToPage} className="flex items-end gap-2">
            <label className="block text-xs font-black uppercase">
              Page
              <input
                className="mt-1 w-24 border-2 border-black bg-white p-2 text-sm text-black"
                type="number"
                min={1}
                max={bundledSrdPageCount}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
              />
            </label>
            <button
              className={`pixel-button px-3 py-2 text-xs font-black ${theme.button}`}
            >
              Go
            </button>
          </form>
          <button
            type="button"
            className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
            onClick={() => goToPage(startPage + srdPageWindowSize)}
            disabled={startPage >= bundledSrdPageCount}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="border-2 border-black bg-[#f8f4e8] p-2 text-xs font-black">
            Showing {pageNumbers[0]}-{pageNumbers[pageNumbers.length - 1]} of{" "}
            {bundledSrdPageCount}
          </p>
        </div>

        <div className="grid max-h-[76vh] gap-4 overflow-auto border-2 border-black bg-[#f8f4e8] p-3">
          {pageNumbers.map((pageNumber) => {
            const pageUrl = apiUrl(
              `/api/campaigns/${campaignSlug}/player-reference/srd/pages/${pageNumber}/image`,
            );
            return (
              <article
                key={pageNumber}
                className="border-2 border-black bg-white p-2"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-black">SRD Page {pageNumber}</h3>
                  <a
                    className="inline-flex items-center gap-1 border-2 border-black bg-[#bff3df] px-2 py-1 text-xs font-black uppercase text-black"
                    href={pageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>
                <img
                  className="mx-auto max-h-[72vh] w-full object-contain"
                  src={pageUrl}
                  alt={`SRD page ${pageNumber}`}
                  loading="lazy"
                />
              </article>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function SourceResult({
  result,
  showFullText = false,
  pageUrl,
}: {
  result: KnowledgeSource & { text?: string };
  showFullText?: boolean;
  pageUrl?: string;
}) {
  const section = result.sectionPath.join(" > ") || result.title;
  return (
    <details
      className="border-2 border-black bg-white p-2 text-sm"
      open={showFullText}
    >
      <summary className="cursor-pointer font-black">
        {result.sourceName} - {section}
      </summary>
      <p className="mt-1 text-xs uppercase">
        {result.sourceType}
        {result.pageNumber ? ` - page ${result.pageNumber}` : ""} - score{" "}
        {result.relevanceScore}
      </p>
      {pageUrl ? (
        <a
          className="mt-2 inline-flex items-center gap-1 border-2 border-black bg-[#bff3df] px-2 py-1 text-xs font-black uppercase text-black"
          href={pageUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View SRD page
        </a>
      ) : null}
      <p className="mt-2 whitespace-pre-wrap text-sm">
        {showFullText && result.text ? result.text : result.textPreview}
      </p>
    </details>
  );
}
