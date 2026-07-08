import type { FormEvent, ReactNode } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Dices,
  Pencil,
  Plus,
  Play,
  RotateCcw,
  Search,
  Swords,
  Trash2,
} from "lucide-react";
import { apiUrl } from "../api";
import { rollDice } from "../../../src/dice.roller";
import type {
  Encounter,
  EncounterCreatureStatKey,
  EncounterDraftCreature,
  EncounterStatus,
  MonsterCatalogEntry,
  MonsterManualDocument,
  PendingLookup,
} from "../domain";
import {
  abilityModifier,
  minimumBundledSrdMonsterEntries,
  monsterProficiencyBonusForChallengeRating,
  pendingIds,
  signedModifier,
} from "../domain";
import { BusyButtonContent, Field, ToggleButtonField } from "./common";
import {
  CreatureStatCard,
  EncounterTurnSummary,
  TurnInstructionCard,
  getCurrentTurnActor,
} from "./encounterShared";

export function EncounterDraftPanel({
  isPending,
  draft,
  encounters,
  theme,
  onCreateEncounter,
  editingEncounterId,
  editingEncounterName,
  onEditEncounterDraft,
  onCancelEncounterDraftEdit,
  onRemoveDraftMonster,
  onUpdateDraftCreature,
  onAddDraftCreatureKeyItem,
  onUpdateDraftCreatureKeyItem,
  onRemoveDraftCreatureKeyItem,
  onStartEncounter,
  onBeginEncounterCombat,
  onUpdateEncounterCreature,
  onSetEncounterStatus,
  onEndDmTurn,
  onResolveEncounter,
}: {
  isPending: PendingLookup;
  draft: EncounterDraftCreature[];
  encounters: Encounter[];
  theme: Record<string, string>;
  onCreateEncounter: (event: FormEvent<HTMLFormElement>) => void;
  editingEncounterId: string;
  editingEncounterName: string;
  onEditEncounterDraft: (encounter: Encounter) => void;
  onCancelEncounterDraftEdit: () => void;
  onRemoveDraftMonster: (index: number) => void;
  onUpdateDraftCreature: (
    index: number,
    field: EncounterCreatureStatKey,
    value: number,
  ) => void;
  onAddDraftCreatureKeyItem: (index: number) => void;
  onUpdateDraftCreatureKeyItem: (
    index: number,
    keyItemIndex: number,
    value: string,
  ) => void;
  onRemoveDraftCreatureKeyItem: (
    index: number,
    keyItemIndex: number,
  ) => void;
  onStartEncounter: (encounterId: string) => void;
  onBeginEncounterCombat: (encounterId: string) => void;
  onUpdateEncounterCreature: (
    encounterId: string,
    encounterCreatureId: string,
    payload: Partial<Record<EncounterCreatureStatKey, number>>,
  ) => void;
  onSetEncounterStatus: (
    encounterId: string,
    status: EncounterStatus,
  ) => void;
  onEndDmTurn: (encounterId: string) => void;
  onResolveEncounter: (encounterId: string) => void;
}) {
  const createEncounterLoading = isPending(pendingIds.createEncounter);
  const activeEncounter = encounters.find(
    (encounter) => encounter.status === "ACTIVE",
  );
  const draftEncounters = encounters.filter(
    (encounter) => encounter.status === "DRAFT",
  );
  const pendingEncounters = encounters.filter(
    (encounter) => encounter.status === "PENDING",
  );
  const archivedEncounters = encounters.filter(
    (encounter) => encounter.status === "ARCHIVED",
  );

  return (
    <div className="mb-4 grid gap-3">
      {activeEncounter ? (
        <DmEncounterControl
          isPending={isPending}
          encounter={activeEncounter}
          theme={theme}
          onEndDmTurn={onEndDmTurn}
          onBeginEncounterCombat={onBeginEncounterCombat}
          onUpdateEncounterCreature={onUpdateEncounterCreature}
          onResolveEncounter={onResolveEncounter}
        />
      ) : null}

      {!activeEncounter ? (
        <div className="border-2 border-black bg-white/85 p-3 text-black">
          <h3 className="mb-2 font-pixel text-[11px] leading-5">
            {editingEncounterId ? "Edit Encounter" : "Encounter Draft"}
          </h3>
          {editingEncounterId ? (
            <p className="mb-3 border-2 border-black bg-[#f8f4e8] p-2 text-sm font-bold">
              Editing {editingEncounterName}
            </p>
          ) : null}
          <div className="mb-3 grid max-h-[560px] gap-2 overflow-auto pr-1">
            {draft.map((entry, index) => (
              <DraftEncounterCreatureCard
                key={`${entry.id}-${index}`}
                entry={entry}
                index={index}
                onRemove={onRemoveDraftMonster}
                onUpdate={onUpdateDraftCreature}
                onAddKeyItem={onAddDraftCreatureKeyItem}
                onUpdateKeyItem={onUpdateDraftCreatureKeyItem}
                onRemoveKeyItem={onRemoveDraftCreatureKeyItem}
              />
            ))}
            {!draft.length ? (
              <p className="border-2 border-black bg-white p-3 text-sm font-bold">
                Search the catalog and add monsters here.
              </p>
            ) : null}
          </div>
          <form
            key={editingEncounterId || "new-encounter"}
            onSubmit={onCreateEncounter}
            className="grid gap-2"
          >
            <Field
              label="Encounter name"
              name="name"
              defaultValue={editingEncounterName}
              compact
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                name="status"
                value="DRAFT"
                className="pixel-button flex items-center justify-center gap-2 bg-white px-3 py-2 font-bold text-black"
                disabled={createEncounterLoading}
              >
                <BusyButtonContent
                  loading={createEncounterLoading}
                  loadingLabel="Saving..."
                  icon={<BookOpen className="h-4 w-4" />}
                >
                  {editingEncounterId ? "Update Draft" : "Save Draft"}
                </BusyButtonContent>
              </button>
              <button
                name="status"
                value="PENDING"
                className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 font-bold ${theme.button}`}
                disabled={createEncounterLoading}
              >
                <BusyButtonContent
                  loading={createEncounterLoading}
                  loadingLabel="Preparing..."
                  icon={<Swords className="h-4 w-4" />}
                >
                  {editingEncounterId ? "Update Pending" : "Mark Pending"}
                </BusyButtonContent>
              </button>
              {editingEncounterId ? (
                <button
                  type="button"
                  className="pixel-button flex items-center justify-center gap-2 bg-[#ffd1dc] px-3 py-2 font-bold text-black"
                  onClick={onCancelEncounterDraftEdit}
                  disabled={createEncounterLoading}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <EncounterList
        title="Draft"
        emptyLabel="No draft encounters."
        encounters={draftEncounters}
        actions={(encounter) => (
          <>
            <EncounterStatusButton
              isPending={isPending}
              encounter={encounter}
              status="PENDING"
              label="Mark Pending"
              loadingLabel="Updating..."
              themeClass={theme.button}
              icon={<CheckCircle2 className="h-3 w-3" />}
              onSetEncounterStatus={onSetEncounterStatus}
            />
            <button
              type="button"
              className="pixel-button flex items-center gap-2 bg-white px-2 py-1 text-xs font-black text-black"
              onClick={() => onEditEncounterDraft(encounter)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <EncounterStatusButton
              isPending={isPending}
              encounter={encounter}
              status="ARCHIVED"
              label="Archive"
              loadingLabel="Archiving..."
              themeClass="bg-[#ffd1dc] text-black"
              icon={<Archive className="h-3 w-3" />}
              onSetEncounterStatus={onSetEncounterStatus}
            />
          </>
        )}
      />

      <EncounterList
        title="Pending"
        emptyLabel="No pending encounters."
        encounters={pendingEncounters}
        actions={(encounter) => (
          <>
            <StartEncounterButton
              isPending={isPending}
              encounter={encounter}
              themeClass={theme.button}
              onStartEncounter={onStartEncounter}
            />
            <button
              type="button"
              className="pixel-button flex items-center gap-2 bg-white px-2 py-1 text-xs font-black text-black"
              onClick={() => onEditEncounterDraft(encounter)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <EncounterStatusButton
              isPending={isPending}
              encounter={encounter}
              status="DRAFT"
              label="Draft"
              loadingLabel="Updating..."
              themeClass="bg-white text-black"
              icon={<BookOpen className="h-3 w-3" />}
              onSetEncounterStatus={onSetEncounterStatus}
            />
            <EncounterStatusButton
              isPending={isPending}
              encounter={encounter}
              status="ARCHIVED"
              label="Archive"
              loadingLabel="Archiving..."
              themeClass="bg-[#ffd1dc] text-black"
              icon={<Archive className="h-3 w-3" />}
              onSetEncounterStatus={onSetEncounterStatus}
            />
          </>
        )}
      />

      <EncounterList
        title="Archived"
        emptyLabel="No archived encounters."
        encounters={archivedEncounters}
        actions={(encounter) => (
          <EncounterStatusButton
            isPending={isPending}
            encounter={encounter}
            status="PENDING"
            label="Restore"
            loadingLabel="Restoring..."
            themeClass="bg-[#bff3df] text-black"
            icon={<RotateCcw className="h-3 w-3" />}
            onSetEncounterStatus={onSetEncounterStatus}
          />
        )}
      />
    </div>
  );
}

const primaryEncounterStats: Array<{
  key: EncounterCreatureStatKey;
  label: string;
}> = [
  { key: "armorClass", label: "Armor Class" },
  { key: "maxHitPoints", label: "Max Hit Points" },
  { key: "currentHp", label: "Current Hit Points" },
  { key: "speed", label: "Speed" },
  { key: "initiative", label: "Initiative" },
];

const abilityEncounterStats: Array<{
  key: EncounterCreatureStatKey;
  label: string;
}> = [
  { key: "strength", label: "Strength" },
  { key: "dexterity", label: "Dexterity" },
  { key: "constitution", label: "Constitution" },
  { key: "intelligence", label: "Intelligence" },
  { key: "wisdom", label: "Wisdom" },
  { key: "charisma", label: "Charisma" },
];

function DraftEncounterCreatureCard({
  entry,
  index,
  onRemove,
  onUpdate,
  onAddKeyItem,
  onUpdateKeyItem,
  onRemoveKeyItem,
}: {
  entry: EncounterDraftCreature;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: EncounterCreatureStatKey,
    value: number,
  ) => void;
  onAddKeyItem: (index: number) => void;
  onUpdateKeyItem: (
    index: number,
    keyItemIndex: number,
    value: string,
  ) => void;
  onRemoveKeyItem: (index: number, keyItemIndex: number) => void;
}) {
  const monsterProficiencyBonus = monsterProficiencyBonusForChallengeRating(
    entry.challengeRating,
  );

  function rollStat(field: EncounterCreatureStatKey) {
    onUpdate(index, field, rollDice(1, 20).total);
  }

  return (
    <article className="grid gap-3 border-2 border-black bg-white p-3 text-xs">
      <div className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
        {entry.pageImageUrl ? (
          <img
            src={apiUrl(entry.pageImageUrl)}
            alt=""
            className="h-20 w-full border-2 border-black object-cover"
          />
        ) : (
          <div className="grid h-20 place-items-center border-2 border-black bg-[#f8f4e8]">
            <Swords className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-black">{entry.name}</p>
          <p className="truncate uppercase">{entry.sizeType}</p>
          <p className="mt-1 text-[11px] font-black uppercase">
            {[
              entry.challengeRating
                ? `Challenge Rating ${entry.challengeRating}`
                : "",
              monsterProficiencyBonus !== null
                ? `Proficiency ${signedModifier(monsterProficiencyBonus)}`
                : "",
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center border-2 border-black bg-[#ffd1dc]"
          onClick={() => onRemove(index)}
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <section>
        <p className="mb-1 font-black uppercase">Vitals</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {primaryEncounterStats.map((stat) => (
            <EncounterStatInput
              key={stat.key}
              label={stat.label}
              value={entry[stat.key]}
              onChange={(value) => onUpdate(index, stat.key, value)}
              onRoll={() => rollStat(stat.key)}
            />
          ))}
        </div>
      </section>

      <section>
        <p className="mb-1 font-black uppercase">Ability Scores</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {abilityEncounterStats.map((stat) => (
            <EncounterStatInput
              key={stat.key}
              label={stat.label}
              value={entry[stat.key]}
              onChange={(value) => onUpdate(index, stat.key, value)}
              onRoll={() => rollStat(stat.key)}
              showModifier
            />
          ))}
        </div>
      </section>

      <details className="border-2 border-black bg-[#f8f4e8] p-2 text-black">
        <summary className="cursor-pointer font-black uppercase">
          Loot, Gear & Key Items
        </summary>
        <div className="mt-2 grid gap-2">
          {entry.keyItems.map((item, keyItemIndex) => (
            <div
              key={keyItemIndex}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <input
                type="text"
                className="min-h-9 border-2 border-black bg-white px-2 text-sm text-black"
                value={item}
                placeholder="Potion, key, clue, weapon, coin pouch..."
                onChange={(event) =>
                  onUpdateKeyItem(index, keyItemIndex, event.currentTarget.value)
                }
              />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center border-2 border-black bg-[#ffd1dc]"
                onClick={() => onRemoveKeyItem(index, keyItemIndex)}
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!entry.keyItems.length ? (
            <p className="border-2 border-black bg-white p-2 text-sm font-bold">
              No items added.
            </p>
          ) : null}
          <button
            type="button"
            className="pixel-button flex items-center justify-center gap-2 bg-white px-3 py-2 text-xs font-black text-black"
            onClick={() => onAddKeyItem(index)}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </details>
    </article>
  );
}

function EncounterStatInput({
  label,
  value,
  onChange,
  onRoll,
  showModifier = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onRoll: () => void;
  showModifier?: boolean;
}) {
  const modifier = abilityModifier(value);

  return (
    <label
      className={`grid items-center gap-2 border-2 border-black bg-[#f8f4e8] p-2 font-black ${
        showModifier
          ? "grid-cols-[minmax(0,1fr)_4rem_3.25rem_2rem]"
          : "grid-cols-[minmax(0,1fr)_4.5rem_2rem]"
      }`}
    >
      <span className="min-w-0 leading-4">{label}</span>
      <input
        type="number"
        className="h-8 w-full border-2 border-black bg-white px-1 text-right text-sm text-black"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value) || 0)}
      />
      {showModifier ? (
        <input
          type="text"
          className="h-8 w-full border-2 border-black bg-white/70 px-1 text-center text-sm text-black"
          value={signedModifier(modifier)}
          readOnly
          tabIndex={-1}
          title={`${label} modifier`}
        />
      ) : null}
      <button
        type="button"
        className="grid h-8 w-8 place-items-center border-2 border-black bg-white text-black"
        onClick={onRoll}
        title={`Roll ${label}`}
      >
        <Dices className="h-4 w-4" />
      </button>
    </label>
  );
}

function EncounterList({
  title,
  emptyLabel,
  encounters,
  actions,
}: {
  title: string;
  emptyLabel: string;
  encounters: Encounter[];
  actions: (encounter: Encounter) => ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="font-pixel text-[11px] leading-5">{title}</h3>
      {encounters.map((encounter) => (
        <div
          key={encounter.id}
          className="border-2 border-black bg-white/85 p-3 text-sm text-black"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-black">{encounter.name}</p>
              <p className="text-xs uppercase">
                {encounter.creatures.length} monsters - {encounter.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">{actions(encounter)}</div>
          </div>
        </div>
      ))}
      {!encounters.length ? (
        <p className="border-2 border-black bg-white/85 p-3 text-sm font-bold text-black">
          {emptyLabel}
        </p>
      ) : null}
    </section>
  );
}

function StartEncounterButton({
  isPending,
  encounter,
  themeClass,
  onStartEncounter,
}: {
  isPending: PendingLookup;
  encounter: Encounter;
  themeClass: string;
  onStartEncounter: (encounterId: string) => void;
}) {
  const loading = isPending(pendingIds.startEncounter(encounter.id));

  return (
    <button
      type="button"
      className={`pixel-button flex items-center gap-2 px-2 py-1 text-xs font-black ${themeClass}`}
      onClick={() => onStartEncounter(encounter.id)}
      disabled={loading}
    >
      <BusyButtonContent
        loading={loading}
        loadingLabel="Starting..."
        icon={<Play className="h-3 w-3" />}
      >
        Start
      </BusyButtonContent>
    </button>
  );
}

function EncounterStatusButton({
  isPending,
  encounter,
  status,
  label,
  loadingLabel,
  themeClass,
  icon,
  onSetEncounterStatus,
}: {
  isPending: PendingLookup;
  encounter: Encounter;
  status: EncounterStatus;
  label: string;
  loadingLabel: string;
  themeClass: string;
  icon: ReactNode;
  onSetEncounterStatus: (
    encounterId: string,
    status: EncounterStatus,
  ) => void;
}) {
  const loading = isPending(
    pendingIds.setEncounterStatus(encounter.id, status),
  );

  return (
    <button
      type="button"
      className={`pixel-button flex items-center gap-2 px-2 py-1 text-xs font-black ${themeClass}`}
      onClick={() => onSetEncounterStatus(encounter.id, status)}
      disabled={loading}
    >
      <BusyButtonContent
        loading={loading}
        loadingLabel={loadingLabel}
        icon={icon}
      >
        {label}
      </BusyButtonContent>
    </button>
  );
}

export function DmEncounterControl({
  isPending,
  encounter,
  theme,
  onEndDmTurn,
  onBeginEncounterCombat,
  onUpdateEncounterCreature,
  onResolveEncounter,
}: {
  isPending: PendingLookup;
  encounter: Encounter;
  theme: Record<string, string>;
  onEndDmTurn: (encounterId: string) => void;
  onBeginEncounterCombat: (encounterId: string) => void;
  onUpdateEncounterCreature: (
    encounterId: string,
    encounterCreatureId: string,
    payload: Partial<Record<EncounterCreatureStatKey, number>>,
  ) => void;
  onResolveEncounter: (encounterId: string) => void;
}) {
  const current = getCurrentTurnActor(encounter);
  const isDmTurn = current?.type === "DM";
  const resolveLoading = isPending(pendingIds.resolveEncounter(encounter.id));
  const endTurnLoading = isPending(pendingIds.endDmTurn(encounter.id));
  const beginLoading = isPending(pendingIds.beginEncounterCombat(encounter.id));
  const phase = encounter.ruleNotes?.phase ?? "ROLLING";

  return (
    <div className="border-2 border-black bg-[#f8f4e8] p-3 text-sm text-black">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{encounter.name}</p>
          <p className="text-xs uppercase">
            {phase} - Round {encounter.ruleNotes?.round ?? 1}
          </p>
        </div>
        <button
          type="button"
          className="pixel-button flex items-center gap-2 bg-[#ffd1dc] px-2 py-1 text-xs font-black text-black"
          onClick={() => onResolveEncounter(encounter.id)}
          disabled={resolveLoading}
        >
          <BusyButtonContent
            loading={resolveLoading}
            loadingLabel="Archiving..."
            icon={<Archive className="h-3 w-3" />}
          >
            Archive
          </BusyButtonContent>
        </button>
      </div>

      <DmEncounterCreatureControls
        isPending={isPending}
        encounter={encounter}
        onUpdateEncounterCreature={onUpdateEncounterCreature}
      />

      {phase === "ROLLING" ? (
        <button
          type="button"
          className={`pixel-button mb-3 flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
          onClick={() => onBeginEncounterCombat(encounter.id)}
          disabled={beginLoading}
        >
          <BusyButtonContent
            loading={beginLoading}
            loadingLabel="Starting combat..."
            icon={<Play className="h-4 w-4" />}
          >
            Begin Combat
          </BusyButtonContent>
        </button>
      ) : null}

      <EncounterTurnSummary encounter={encounter} />

      {isDmTurn ? (
        <>
          <TurnInstructionCard audience="dm" />
          <button
            type="button"
            className={`pixel-button mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
            onClick={() => onEndDmTurn(encounter.id)}
            disabled={endTurnLoading}
          >
            <BusyButtonContent
              loading={endTurnLoading}
              loadingLabel="Ending turn..."
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              End DM Turn
            </BusyButtonContent>
          </button>
        </>
      ) : null}

      <div className="mt-3 grid gap-2">
        {encounter.creatures.map((entry) => (
          <CreatureStatCard
            key={entry.id}
            creature={entry.creature}
            encounterCreature={entry}
            showKeyItems
          />
        ))}
      </div>
    </div>
  );
}

function DmEncounterCreatureControls({
  isPending,
  encounter,
  onUpdateEncounterCreature,
}: {
  isPending: PendingLookup;
  encounter: Encounter;
  onUpdateEncounterCreature: (
    encounterId: string,
    encounterCreatureId: string,
    payload: Partial<Record<EncounterCreatureStatKey, number>>,
  ) => void;
}) {
  return (
    <div className="mb-3 grid gap-2">
      <p className="font-black uppercase">Enemy Controls</p>
      {encounter.creatures.map((entry) => {
        const loading = isPending(pendingIds.updateEncounterCreature(entry.id));

        function submitCreatureStats(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onUpdateEncounterCreature(encounter.id, entry.id, {
            armorClass: numberFromForm(data, "armorClass"),
            maxHitPoints: numberFromForm(data, "maxHitPoints"),
            currentHp: numberFromForm(data, "currentHp"),
            initiative: numberFromForm(data, "initiative"),
            speed: numberFromForm(data, "speed"),
          });
        }

        return (
          <form
            key={entry.id}
            onSubmit={submitCreatureStats}
            className="grid gap-2 border-2 border-black bg-white p-2 sm:grid-cols-[minmax(0,1fr)_repeat(5,5rem)_auto] sm:items-end"
          >
            <div className="min-w-0">
              <p className="truncate font-black">
                {entry.nickname || entry.creature.name}
              </p>
              <p className="text-xs uppercase">Enemy</p>
            </div>
            <CompactNumberField
              label="Armor"
              name="armorClass"
              defaultValue={entry.armorClass ?? entry.creature.armorClass ?? 10}
            />
            <CompactNumberField
              label="Max HP"
              name="maxHitPoints"
              defaultValue={
                entry.maxHitPoints ?? entry.creature.hitPoints ?? 1
              }
            />
            <CompactNumberField
              label="HP"
              name="currentHp"
              defaultValue={
                entry.currentHp ??
                entry.maxHitPoints ??
                entry.creature.hitPoints ??
                1
              }
            />
            <CompactNumberField
              label="Initiative"
              name="initiative"
              defaultValue={entry.initiative ?? 0}
            />
            <CompactNumberField
              label="Speed"
              name="speed"
              defaultValue={entry.speed ?? 30}
            />
            <button
              className="pixel-button flex min-h-9 items-center justify-center gap-2 bg-white px-2 py-1 text-xs font-black text-black"
              disabled={loading}
            >
              <BusyButtonContent loading={loading} loadingLabel="Saving...">
                Save
              </BusyButtonContent>
            </button>
          </form>
        );
      })}
    </div>
  );
}

function CompactNumberField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <label className="block text-xs font-black">
      {label}
      <input
        name={name}
        type="number"
        defaultValue={defaultValue}
        className="mt-1 h-9 w-full border-2 border-black bg-white px-1 text-right text-sm text-black"
      />
    </label>
  );
}

function numberFromForm(data: FormData, name: string) {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? value : 0;
}

export function MonsterCatalogPanel({
  isPending,
  theme,
  documents,
  results,
  onSearch,
  onAddToDraft,
}: {
  isPending: PendingLookup;
  theme: Record<string, string>;
  documents: MonsterManualDocument[];
  results: MonsterCatalogEntry[];
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onAddToDraft: (result: MonsterCatalogEntry) => void;
}) {
  const hasSrdCatalog = documents.some(
    (document) =>
      document.originalFileName === "SRD_CC_v5.1.pdf" &&
      document.entryCount >= minimumBundledSrdMonsterEntries,
  );
  const searchLoading = isPending(pendingIds.searchMonsterCatalog);

  return (
    <div className="mb-4 border-2 border-black bg-white/85 p-3 text-black">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-pixel text-[11px] leading-5">
          <BookOpen className="h-4 w-4" />
          Monster Catalog
        </h3>
        <p className="text-[11px] font-black uppercase">
          {documents.reduce(
            (total, document) => total + document.entryCount,
            0,
          )}
        </p>
      </div>

      {!hasSrdCatalog ? (
        <p className="mb-3 border-2 border-black bg-[#fff5cc] p-2 text-xs font-bold">
          Import SRD monsters from Settings before searching the default
          catalog.
        </p>
      ) : null}

      <form
        onSubmit={onSearch}
        className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      >
        <Field label="Catalog search" name="q" compact />
        <ToggleButtonField
          name="wholeWords"
          label="Whole Words"
          title="Match search terms as complete words"
          compact
        />
        <button
          className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
          disabled={searchLoading}
        >
          <BusyButtonContent
            loading={searchLoading}
            loadingLabel="Searching..."
            icon={<Search className="h-4 w-4" />}
          >
            Search Catalog
          </BusyButtonContent>
        </button>
      </form>

      <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
        {results.map((result) => (
          <MonsterCatalogResult
            key={result.id}
            result={result}
            onAddToDraft={onAddToDraft}
          />
        ))}
      </div>
    </div>
  );
}

export function MonsterCatalogResult({
  result,
  onAddToDraft,
}: {
  result: MonsterCatalogEntry;
  onAddToDraft: (result: MonsterCatalogEntry) => void;
}) {
  const monsterProficiencyBonus = monsterProficiencyBonusForChallengeRating(
    result.challengeRating,
  );

  return (
    <article className="grid gap-2 border-2 border-black bg-white p-2 text-xs sm:grid-cols-[96px_1fr]">
      <a href={apiUrl(result.pageImageUrl)} target="_blank" rel="noreferrer">
        <img
          src={apiUrl(result.pageImageUrl)}
          alt=""
          className="h-28 w-full border-2 border-black object-cover"
        />
      </a>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-black">{result.name}</h4>
            <p className="uppercase">{result.sizeType}</p>
          </div>
          <p className="shrink-0 font-black">p. {result.pageNumber}</p>
        </div>
        <p className="mt-1 font-bold">
          {[
            result.armorClass ? `Armor Class ${result.armorClass}` : "",
            result.hitPoints ? `Hit Points ${result.hitPoints}` : "",
            result.challengeRating
              ? `Challenge Rating ${result.challengeRating}`
              : "",
            monsterProficiencyBonus !== null
              ? `Proficiency ${signedModifier(monsterProficiencyBonus)}`
              : "",
          ]
            .filter(Boolean)
            .join(" / ")}
        </p>
        <p className="mt-1 text-[11px]">{result.sourceName}</p>
        <p className="mt-2 max-h-20 overflow-hidden">{result.textPreview}</p>
        <button
          type="button"
          className="pixel-button mt-2 flex w-full items-center justify-center gap-2 bg-[#bff3df] px-2 py-1 font-black text-black"
          onClick={() => onAddToDraft(result)}
          disabled={!result.creatureId}
        >
          <Swords className="h-3 w-3" />
          Add
        </button>
      </div>
    </article>
  );
}
