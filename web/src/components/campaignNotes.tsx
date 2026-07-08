import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import type {
  Campaign,
  CampaignLocation,
  CampaignNote,
  CampaignNoteType,
  PendingLookup,
} from "../domain";
import {
  campaignNoteAttachmentTypeLabels,
  campaignNoteAttachmentTypes,
  campaignNoteTriggerTypeLabels,
  campaignNoteTriggerTypes,
  campaignNoteTypeLabels,
  campaignNoteTypes,
  dateTimeLocalValue,
  pendingIds,
  rangeRows,
} from "../domain";
import {
  BusyButtonContent,
  CampaignLocationSelect,
  CampaignPlayerSelect,
  Field,
  SelectField,
  TextAreaField,
} from "./common";

export function CampaignNotesPanel({
  isPending,
  campaign,
  theme,
  results,
  onCreateLocation,
  onCreateNote,
  onSearch,
  onMoveNote,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  theme: Record<string, string>;
  results: CampaignNote[];
  onCreateLocation: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onCreateNote: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onMoveNote: (noteId: string, direction: "up" | "down") => void;
}) {
  const [attachmentRows, setAttachmentRows] = useState([0]);
  const [triggerRows, setTriggerRows] = useState([0]);
  const [editingNote, setEditingNote] = useState<CampaignNote | null>(null);
  const [editingLocation, setEditingLocation] =
    useState<CampaignLocation | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedLocationIds, setCollapsedLocationIds] = useState<Set<string>>(
    new Set(),
  );
  const notes = results.length ? results : (campaign.campaignNotes ?? []);
  const activePlayers = campaign.players.filter((player) => !player.archivedAt);
  const notesByLocation = useMemo(() => {
    const grouped = new Map<string, CampaignNote[]>();

    for (const note of notes) {
      const key = note.locationId ?? "unassigned";
      grouped.set(key, [...(grouped.get(key) ?? []), note]);
    }

    return grouped;
  }, [notes]);
  const locations = campaign.locations ?? [];
  const visibleLocations = results.length
    ? locations.filter((location) => notesByLocation.has(location.id))
    : locations;
  const unassignedNotes = notesByLocation.get("unassigned") ?? [];
  const showingSearchResults = results.length > 0;
  const saveLocationLoading = isPending(pendingIds.saveLocation);
  const saveNoteLoading = isPending(pendingIds.saveNote);
  const searchLoading = isPending(pendingIds.searchNotes);
  const formMode = noteFormOpen || locationFormOpen;

  function startAddingNote() {
    setEditingNote(null);
    setAttachmentRows([0]);
    setTriggerRows([0]);
    setNoteFormOpen(true);
    setLocationFormOpen(false);
    setSearchOpen(false);
  }

  function startEditingNote(note: CampaignNote) {
    setEditingNote(note);
    setAttachmentRows(rangeRows(note.attachments.length));
    setTriggerRows(rangeRows(note.triggers.length));
    setNoteFormOpen(true);
    setLocationFormOpen(false);
    setSearchOpen(false);
  }

  function clearEditingNote() {
    setEditingNote(null);
    setAttachmentRows([0]);
    setTriggerRows([0]);
    setNoteFormOpen(false);
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    const saved = await onCreateNote(event);
    if (saved) {
      clearEditingNote();
    }
  }

  function startAddingLocation() {
    setEditingLocation(null);
    setLocationFormOpen(true);
    setNoteFormOpen(false);
    setSearchOpen(false);
  }

  function startEditingLocation(location: CampaignLocation) {
    setEditingLocation(location);
    setLocationFormOpen(true);
    setNoteFormOpen(false);
    setSearchOpen(false);
  }

  function clearEditingLocation() {
    setEditingLocation(null);
    setLocationFormOpen(false);
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    const saved = await onCreateLocation(event);
    if (saved) {
      clearEditingLocation();
    }
  }

  function toggleLocation(locationId: string) {
    setCollapsedLocationIds((current) => {
      const next = new Set(current);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  }

  function locationExpanded(locationId: string) {
    return !collapsedLocationIds.has(locationId);
  }

  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-pixel text-xs leading-5">
          <FileText className="h-4 w-4" />
          Campaign Notes
        </h2>
        <p className="text-[11px] font-black uppercase">
          {campaign.locations?.length ?? 0} locations /{" "}
          {campaign.campaignNotes?.length ?? 0} notes
        </p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!formMode ? (
          <>
            <button
              type="button"
              className={`pixel-button grid h-9 w-9 place-items-center ${theme.button}`}
              onClick={() => setSearchOpen((value) => !value)}
              title={searchOpen ? "Hide search" : "Search notes"}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              onClick={startAddingNote}
            >
              <Plus className="h-4 w-4" />
              Add Note
            </button>
            <button
              type="button"
              className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              onClick={startAddingLocation}
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          </>
        ) : null}
        {noteFormOpen ? (
          <button
            type="button"
            className="pixel-button bg-white px-3 py-2 text-xs font-black text-black"
            onClick={clearEditingNote}
          >
            Close Form
          </button>
        ) : null}
        {locationFormOpen ? (
          <button
            type="button"
            className="pixel-button bg-white px-3 py-2 text-xs font-black text-black"
            onClick={clearEditingLocation}
          >
            Close Location
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3">
          {locationFormOpen ? (
            <form
              key={editingLocation?.id ?? "new-location"}
              onSubmit={submitLocation}
              className="border-2 border-black bg-white/85 p-3 text-black"
            >
              <input
                type="hidden"
                name="locationId"
                value={editingLocation?.id ?? ""}
              />
              <input
                type="hidden"
                name="sortOrder"
                value={editingLocation?.sortOrder ?? ""}
              />
              <h3 className="mb-2 font-pixel text-[11px] leading-5">
                {editingLocation ? "Edit Location" : "Location"}
              </h3>
              <Field
                label="Name"
                name="name"
                defaultValue={editingLocation?.name ?? ""}
                compact
              />
              <TextAreaField
                label="Description"
                name="description"
                rows={4}
                defaultValue={
                  editingLocation?.description
                    ?.map((entry) => entry.text)
                    .join("\n") ?? ""
                }
                required={false}
                compact
              />
              <button
                className={`pixel-button mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
                disabled={saveLocationLoading}
              >
                <BusyButtonContent
                  loading={saveLocationLoading}
                  loadingLabel="Saving..."
                  icon={<Save className="h-4 w-4" />}
                >
                  Save Location
                </BusyButtonContent>
              </button>
            </form>
          ) : null}

          {searchOpen && !formMode ? (
            <form
              onSubmit={onSearch}
              className="border-2 border-black bg-white/85 p-3 text-black"
            >
              <h3 className="mb-2 flex items-center gap-2 font-pixel text-[11px] leading-5">
                <Search className="h-4 w-4" />
                Search
              </h3>
              <Field label="Keywords" name="q" required={false} compact />
              <div className="grid gap-2 sm:grid-cols-2">
                <CampaignLocationSelect
                  locations={campaign.locations ?? []}
                  name="locationId"
                  label="Location"
                  includeAny
                />
                <CampaignPlayerSelect
                  players={campaign.players}
                  name="playerId"
                  label="Player"
                  includeAny
                />
              </div>
              <SelectField
                label="Type"
                name="type"
                options={["" as CampaignNoteType, ...campaignNoteTypes]}
                defaultValue={"" as CampaignNoteType}
                optionLabel={(value) =>
                  value ? campaignNoteTypeLabels[value] : "Any"
                }
                compact
              />
              <button
                className={`pixel-button mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
                disabled={searchLoading}
              >
                <BusyButtonContent
                  loading={searchLoading}
                  loadingLabel="Searching..."
                  icon={<Search className="h-4 w-4" />}
                >
                  Search Notes
                </BusyButtonContent>
              </button>
            </form>
          ) : null}
        </div>

        {noteFormOpen ? (
          <form
            key={editingNote?.id ?? "new-note"}
            onSubmit={submitNote}
            className="border-2 border-black bg-white/85 p-3 text-black"
          >
            <input type="hidden" name="noteId" value={editingNote?.id ?? ""} />
            <input
              type="hidden"
              name="sortOrder"
              value={editingNote?.sortOrder ?? ""}
            />
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-pixel text-[11px] leading-5">
                {editingNote ? "Edit Note" : "Note"}
              </h3>
              {editingNote ? (
                <button
                  type="button"
                  className="pixel-button bg-white px-2 py-1 text-xs font-black text-black"
                  onClick={clearEditingNote}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <CampaignLocationSelect
                locations={campaign.locations ?? []}
                name="locationId"
                label="Location"
                includeAny
                defaultValue={editingNote?.locationId ?? ""}
              />
              <SelectField
                label="Type"
                name="type"
                options={campaignNoteTypes}
                defaultValue={editingNote?.type ?? "IMPORTANT_EVENT"}
                optionLabel={(value) => campaignNoteTypeLabels[value]}
                compact
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_180px]">
              <Field
                label="Title"
                name="title"
                defaultValue={editingNote?.title ?? ""}
                compact
              />
              <Field
                label="Occurred"
                name="occurredAt"
                type="datetime-local"
                defaultValue={dateTimeLocalValue(editingNote?.occurredAt)}
                required={false}
                compact
              />
            </div>
            <Field
              label="Summary"
              name="summary"
              defaultValue={editingNote?.summary ?? ""}
              required={false}
              compact
            />
            <TextAreaField
              label="Story"
              name="content"
              rows={6}
              defaultValue={editingNote?.content ?? ""}
              required={false}
              compact
            />
            <Field
              label="Keywords"
              name="keywords"
              defaultValue={editingNote?.keywords.join(", ") ?? ""}
              required={false}
              compact
            />

            <div className="mb-2 border-2 border-black bg-[#f8f4e8] p-2">
              <p className="mb-2 text-xs font-black uppercase">Players</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activePlayers.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center gap-2 border-2 border-black bg-white p-2 text-sm font-bold"
                  >
                    <input
                      type="checkbox"
                      name="playerIds"
                      value={player.id}
                      defaultChecked={Boolean(
                        editingNote?.players.some(
                          (entry) => entry.player.id === player.id,
                        ),
                      )}
                    />
                    {player.name}
                  </label>
                ))}
                {!activePlayers.length ? (
                  <p className="border-2 border-black bg-white p-2 text-sm font-bold">
                    No active players.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-2 border-2 border-black bg-[#f8f4e8] p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase">Attachments</p>
                <button
                  type="button"
                  className="pixel-button bg-[#bff3df] px-2 py-1 text-xs font-black text-black"
                  onClick={() =>
                    setAttachmentRows((current) => [
                      ...current,
                      Math.max(...current) + 1,
                    ])
                  }
                >
                  Add
                </button>
              </div>
              <div className="grid gap-2">
                {attachmentRows.map((rowId) => {
                  const attachment = editingNote?.attachments[rowId];
                  return (
                    <div
                      key={rowId}
                      className="grid gap-2 border-2 border-black bg-white p-2 md:grid-cols-[170px_1fr_1fr_90px_auto]"
                    >
                      <SelectField
                        label="Type"
                        name="attachmentType"
                        options={campaignNoteAttachmentTypes}
                        defaultValue={attachment?.type ?? "LOOT_GEAR"}
                        optionLabel={(value) =>
                          campaignNoteAttachmentTypeLabels[value]
                        }
                        compact
                      />
                      <Field
                        label="Name"
                        name="attachmentName"
                        defaultValue={attachment?.name ?? ""}
                        required={false}
                        compact
                      />
                      <Field
                        label="Details"
                        name="attachmentDetails"
                        defaultValue={attachment?.details ?? ""}
                        required={false}
                        compact
                      />
                      <Field
                        label="Qty"
                        name="attachmentQuantity"
                        type="number"
                        defaultValue={attachment?.quantity ?? ""}
                        required={false}
                        compact
                      />
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center self-end border-2 border-black bg-[#ffd1dc]"
                        onClick={() =>
                          setAttachmentRows((current) =>
                            current.length === 1
                              ? current
                              : current.filter((id) => id !== rowId),
                          )
                        }
                        title="Remove attachment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-2 border-2 border-black bg-[#f8f4e8] p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase">
                  Triggers & Mechanics
                </p>
                <button
                  type="button"
                  className="pixel-button bg-[#bff3df] px-2 py-1 text-xs font-black text-black"
                  onClick={() =>
                    setTriggerRows((current) => [
                      ...current,
                      Math.max(...current) + 1,
                    ])
                  }
                >
                  Add
                </button>
              </div>
              <div className="grid gap-2">
                {triggerRows.map((rowId) => {
                  const trigger = editingNote?.triggers[rowId];
                  return (
                    <div
                      key={rowId}
                      className="grid gap-2 border-2 border-black bg-white p-2 xl:grid-cols-[170px_1fr_150px_90px_170px_auto]"
                    >
                      <SelectField
                        label="Trigger"
                        name="triggerType"
                        options={campaignNoteTriggerTypes}
                        defaultValue={trigger?.type ?? "ROLL_CHECK"}
                        optionLabel={(value) =>
                          campaignNoteTriggerTypeLabels[value]
                        }
                        compact
                      />
                      <Field
                        label="Label"
                        name="triggerLabel"
                        placeholder="Perception check notices the ambush"
                        defaultValue={trigger?.label ?? ""}
                        required={false}
                        compact
                      />
                      <Field
                        label="Check/Flag"
                        name="triggerCheckType"
                        placeholder="perception"
                        defaultValue={trigger?.checkType ?? ""}
                        required={false}
                        compact
                      />
                      <Field
                        label="DC"
                        name="triggerDifficultyClass"
                        type="number"
                        defaultValue={trigger?.difficultyClass ?? ""}
                        required={false}
                        compact
                      />
                      <CampaignPlayerSelect
                        players={campaign.players}
                        name="triggerPlayerId"
                        label="Player"
                        includeAny
                        defaultValue={trigger?.player?.id ?? ""}
                      />
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center self-end border-2 border-black bg-[#ffd1dc]"
                        onClick={() =>
                          setTriggerRows((current) =>
                            current.length === 1
                              ? current
                              : current.filter((id) => id !== rowId),
                          )
                        }
                        title="Remove trigger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <TextAreaField
                        label="DM Mechanics"
                        name="triggerDescription"
                        rows={2}
                        defaultValue={trigger?.description ?? ""}
                        required={false}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="mb-3 flex items-center gap-2 text-sm font-black">
              <input
                type="checkbox"
                name="dmPrivate"
                defaultChecked={editingNote?.dmPrivate ?? true}
              />
              DM Private
            </label>
            <button
              className={`pixel-button flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
              disabled={saveNoteLoading}
            >
              <BusyButtonContent
                loading={saveNoteLoading}
                loadingLabel="Saving..."
                icon={<Save className="h-4 w-4" />}
              >
                {editingNote ? "Update Note" : "Save Note"}
              </BusyButtonContent>
            </button>
          </form>
        ) : null}
      </div>

      {!formMode ? (
        <div className="mt-3 grid gap-3">
          {showingSearchResults ? (
            <p className="border-2 border-black bg-white/85 p-3 text-xs font-black uppercase text-black">
              Showing {results.length} matching notes
            </p>
          ) : null}

          {visibleLocations.map((location) => {
            const locationNotes = notesByLocation.get(location.id) ?? [];
            const expanded = locationExpanded(location.id);

            return (
              <article
                key={location.id}
                className="border-2 border-black bg-white/85 p-3 text-black"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black">{location.name}</h3>
                    <p className="text-xs font-black uppercase">
                      {locationNotes.length} notes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
                      onClick={() => toggleLocation(location.id)}
                      title={
                        expanded
                          ? "Collapse location notes"
                          : "Expand location notes"
                      }
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center border-2 border-black bg-[#bff3df]"
                      onClick={() => startEditingLocation(location)}
                      title="Edit location"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {location.description?.map((description) => (
                  <p key={description.sortOrder} className="mt-1 text-sm">
                    {description.text}
                  </p>
                ))}

                {expanded ? (
                  <div className="mt-3 grid gap-3">
                    {locationNotes.sort((a, b) => {
                      if (a.sortOrder === b.sortOrder) {
                        return 0;
                      } else if (b.sortOrder < a.sortOrder) {
                        return -1;
                      } else {
                        return 1;
                      }
                    }).map((note) => (
                      <CampaignNoteCard
                        key={note.id}
                        note={note}
                        isPending={isPending}
                        onEdit={startEditingNote}
                        onMove={onMoveNote}
                      />
                    ))}
                    {!locationNotes.length ? (
                      <p className="border-2 border-black bg-white p-3 text-sm font-bold">
                        No notes attached to this location.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}

          {unassignedNotes.length ? (
            <article className="border-2 border-black bg-white/85 p-3 text-black">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-black">Unassigned Notes</h3>
                  <p className="text-xs font-black uppercase">
                    {unassignedNotes.length} notes
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
                  onClick={() => toggleLocation("unassigned")}
                  title={
                    locationExpanded("unassigned")
                      ? "Collapse unassigned notes"
                      : "Expand unassigned notes"
                  }
                >
                  {locationExpanded("unassigned") ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {locationExpanded("unassigned") ? (
                <div className="grid gap-3">
                  {unassignedNotes.map((note) => (
                    <CampaignNoteCard
                      key={note.id}
                      note={note}
                      isPending={isPending}
                      onEdit={startEditingNote}
                      onMove={onMoveNote}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}

          {!visibleLocations.length && !unassignedNotes.length ? (
            <p className="border-2 border-black bg-white/85 p-3 text-sm font-bold text-black">
              {showingSearchResults
                ? "No matching campaign notes."
                : "No campaign notes or locations saved."}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function CampaignNoteCard({
  note,
  isPending,
  onEdit,
  onMove,
}: {
  note: CampaignNote;
  isPending: PendingLookup;
  onEdit: (note: CampaignNote) => void;
  onMove: (noteId: string, direction: "up" | "down") => void;
}) {
  const movingUp = isPending(pendingIds.moveNote(note.id, "up"));
  const movingDown = isPending(pendingIds.moveNote(note.id, "down"));
  return (
    <article className="border-2 border-black bg-white/90 p-3 text-sm text-black">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-black">{note.title}</h3>
          <p className="text-xs font-black uppercase">
            {campaignNoteTypeLabels[note.type]}{" "}
            {note.location ? `- ${note.location.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="border-2 border-black bg-[#f8f4e8] px-2 py-1 text-xs font-black">
            {note.dmPrivate ? "DM" : "Table"}
          </p>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
            onClick={() => onMove(note.id, "up")}
            title="Move note up"
            disabled={movingUp}
          >
            {movingUp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
            onClick={() => onMove(note.id, "down")}
            title="Move note down"
            disabled={movingDown}
          >
            {movingDown ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center border-2 border-black bg-[#bff3df]"
            onClick={() => onEdit(note)}
            title="Edit note"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
      {note.summary ? <p className="mb-2 font-bold">{note.summary}</p> : null}
      {note.content ? (
        <p className="mb-2 whitespace-pre-wrap leading-6">{note.content}</p>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2">
        {note.players.map(({ player }) => (
          <span
            key={player.id}
            className="border-2 border-black bg-[#bff3df] px-2 py-1 text-xs font-black"
          >
            {player.name}
          </span>
        ))}
        {note.keywords.map((keyword) => (
          <span
            key={keyword}
            className="border-2 border-black bg-[#f8f4e8] px-2 py-1 text-xs font-black"
          >
            {keyword}
          </span>
        ))}
      </div>
      {note.triggers.length ? (
        <div className="mb-2 border-2 border-black bg-[#f8f4e8] p-2">
          <p className="mb-2 text-xs font-black uppercase">
            Triggers & Mechanics
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {note.triggers.map((trigger) => (
              <div
                key={trigger.id}
                className="border-2 border-black bg-white p-2"
              >
                <p className="text-xs font-black uppercase">
                  {campaignNoteTriggerTypeLabels[trigger.type]}
                  {trigger.player ? ` - ${trigger.player.name}` : ""}
                </p>
                <p className="font-black">{trigger.label}</p>
                <p className="mt-1 text-xs font-semibold">
                  {[
                    trigger.checkType ? `Check: ${trigger.checkType}` : "",
                    trigger.difficultyClass
                      ? `DC ${trigger.difficultyClass}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
                {trigger.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs">
                    {trigger.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {note.attachments.length ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {note.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="border-2 border-black bg-[#f8f4e8] p-2"
            >
              <p className="text-xs font-black uppercase">
                {campaignNoteAttachmentTypeLabels[attachment.type]}
              </p>
              <p className="font-black">
                {attachment.name}
                {attachment.quantity ? ` x${attachment.quantity}` : ""}
              </p>
              {attachment.details ? (
                <p className="mt-1 text-xs font-semibold">
                  {attachment.details}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
