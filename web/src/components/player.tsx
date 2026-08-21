import { useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Coins,
  Image,
  Map as MapIcon,
  Search,
  Swords,
  UserPlus,
} from "lucide-react";
import { apiUrl } from "../api";
import type {
  Asset,
  Campaign,
  CharacterSheetHistoryEntry,
  CharacterSheetPayload,
  Encounter,
  KnowledgeChatResponse,
  PendingLookup,
  Player,
  PlayerReferenceCategory,
  ThemeKey,
} from "../domain";
import {
  pendingIds,
  playerReferenceCategories,
  playerReferenceCategoryLabels,
  themeClasses,
} from "../domain";
import {
  BusyButtonContent,
  Field,
  PersistentTabPanel,
  SelectField,
  TabBar,
  ToggleButtonField,
} from "./common";
import { CharacterSheet } from "./characterSheet";
import { MapBoard } from "./media";
import {
  CreatureStatCard,
  EncounterTurnSummary,
  TurnInstructionCard,
  getCurrentTurnActor,
} from "./encounterShared";
import { SourceResult } from "./knowledge";

export function PlayerWelcome({ theme }: { theme: Record<string, string> }) {
  return (
    <section className={`pixel-panel ${theme.panel} p-4`}>
      <h2 className="mb-3 flex items-center gap-2 font-pixel text-sm leading-6">
        <UserPlus className="h-5 w-5" />
        Join Campaign
      </h2>
      <p className="border-2 border-black bg-white/80 p-3 text-sm font-bold text-black">
        Join from the side panel with your player name and access code to open
        your map, encounter view, and character sheet.
      </p>
    </section>
  );
}

export function PlayerWorkspace({
  isPending,
  campaign,
  player,
  currentCampaignMap,
  currentStoryImage,
  theme,
  playerReferenceChat,
  characterSheetHistory,
  onAskPlayerReference,
  onSubmitInitiative,
  onEndPlayerTurn,
  onUpdateCharacterSheet,
  onUpdatePlayerTheme,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  player: Player;
  currentCampaignMap?: Asset;
  currentStoryImage?: Asset;
  theme: Record<string, string>;
  playerReferenceChat: KnowledgeChatResponse | null;
  characterSheetHistory: CharacterSheetHistoryEntry[];
  onAskPlayerReference: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitInitiative: (
    encounterId: string,
    playerId: string,
    roll: number,
  ) => Promise<void>;
  onEndPlayerTurn: (encounterId: string, playerId: string) => Promise<void>;
  onUpdateCharacterSheet: (
    playerId: string,
    payload: CharacterSheetPayload,
  ) => Promise<void>;
  onUpdatePlayerTheme: (theme: ThemeKey) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<
    "map" | "encounter" | "sheet" | "reference" | "settings"
  >("map");
  const activeEncounter = campaign.encounters?.find(
    (encounter) => encounter.status === "ACTIVE",
  );

  return (
    <div className="grid gap-3">
      <TabBar
        theme={theme}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "map", label: "Map" },
          { id: "encounter", label: "Encounter" },
          { id: "sheet", label: "Sheet" },
          { id: "reference", label: "Reference" },
          ...(campaign.allowPlayerTheme
            ? [{ id: "settings" as const, label: "Settings" }]
            : []),
        ]}
      />

      <PersistentTabPanel active={activeTab === "map"}>
        <section className={`pixel-panel ${theme.panel} p-4`}>
          <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
            <MapIcon />
            Map
          </h2>
          {campaign.storyImageVisible && currentStoryImage ? (
            <div className="mb-3 border-2 border-black bg-white/85 p-3 text-black">
              <h3 className="mb-2 flex items-center gap-2 font-pixel text-[11px] leading-5">
                <Image className="h-4 w-4" />
                Scene
              </h3>
              <img
                className="max-h-[70vh] w-full border-2 border-black object-contain"
                src={apiUrl(currentStoryImage.url)}
                alt={currentStoryImage.name}
              />
            </div>
          ) : null}
          {campaign.playerMapVisible !== false && currentCampaignMap ? (
            <MapBoard currentCampaignMap={currentCampaignMap} />
          ) : (
            <div className="border-2 border-black bg-white/80 p-3 text-sm font-bold text-black">
              {campaign.playerMapVisible === false
                ? "The DM has hidden the campaign map."
                : "No campaign map selected."}
            </div>
          )}
        </section>
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "encounter"}>
        {activeEncounter ? (
          <PlayerEncounterPanel
            isPending={isPending}
            encounter={activeEncounter}
            player={player}
            theme={theme}
            onSubmitInitiative={onSubmitInitiative}
            onEndPlayerTurn={onEndPlayerTurn}
          />
        ) : (
          <section className={`pixel-panel ${theme.panel} p-4`}>
            <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
              <Swords className="h-5 w-5" />
              Encounter
            </h2>
            <p className="border-2 border-black bg-white/80 p-3 text-sm font-bold text-black">
              No active encounter.
            </p>
          </section>
        )}
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "sheet"}>
        <section className={`pixel-panel ${theme.panel} p-4`}>
          <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
            <Coins className="h-5 w-5" />
            Character Sheet
          </h2>
          <CharacterSheet
            isPending={isPending}
            player={player}
            history={characterSheetHistory}
            onSave={onUpdateCharacterSheet}
          />
        </section>
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "reference"}>
        <PlayerReferencePanel
          isPending={isPending}
          campaignSlug={campaign.slug}
          theme={theme}
          chat={playerReferenceChat}
          onAsk={onAskPlayerReference}
        />
      </PersistentTabPanel>

      <PersistentTabPanel
        active={activeTab === "settings" && Boolean(campaign.allowPlayerTheme)}
      >
        <PlayerThemePanel
          isPending={isPending}
          player={player}
          theme={theme}
          onUpdatePlayerTheme={onUpdatePlayerTheme}
        />
      </PersistentTabPanel>
    </div>
  );
}

function PlayerThemePanel({
  isPending,
  player,
  theme,
  onUpdatePlayerTheme,
}: {
  isPending: PendingLookup;
  player: Player;
  theme: Record<string, string>;
  onUpdatePlayerTheme: (theme: ThemeKey) => Promise<void>;
}) {
  const loading = isPending(pendingIds.updateOwnTheme);

  return (
    <section className={`pixel-panel ${theme.panel} p-4`}>
      <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
        <BookOpen className="h-5 w-5" />
        Settings
      </h2>
      <label className="mb-3 block text-sm font-bold">
        Theme
        <select
          className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
          value={player.theme ?? ""}
          disabled={loading}
          onChange={(event) =>
            onUpdatePlayerTheme(event.currentTarget.value as ThemeKey)
          }
        >
          <option value="" disabled>
            Campaign Theme
          </option>
          {Object.keys(themeClasses).map((themeKey) => (
            <option key={themeKey} value={themeKey}>
              {themeKey
                .toLowerCase()
                .split("_")
                .map((word) => word[0].toUpperCase() + word.slice(1))
                .join(" ")}
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <p className="border-2 border-black bg-white p-2 text-xs font-black text-black">
          Updating theme...
        </p>
      ) : null}
    </section>
  );
}

export function PlayerEncounterPanel({
  isPending,
  encounter,
  player,
  theme,
  onSubmitInitiative,
  onEndPlayerTurn,
}: {
  isPending: PendingLookup;
  encounter: Encounter;
  player: Player;
  theme: Record<string, string>;
  onSubmitInitiative: (
    encounterId: string,
    playerId: string,
    roll: number,
  ) => Promise<void>;
  onEndPlayerTurn: (encounterId: string, playerId: string) => Promise<void>;
}) {
  const phase = encounter.ruleNotes?.phase ?? "ROLLING";
  const current = getCurrentTurnActor(encounter);
  const rolls = encounter.ruleNotes?.initiativeRolls ?? {};
  const isCurrentPlayerTurn =
    current?.type === "PLAYER" &&
    (current.id === player.id || current.name === player.name);
  const initiativeLoading = isPending(
    pendingIds.submitInitiative(encounter.id, player.id),
  );
  const endTurnLoading =
    current?.type === "PLAYER"
      ? isPending(pendingIds.endPlayerTurn(encounter.id, current.id))
      : false;

  function submitRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roll = Number(data.get("roll"));
    void onSubmitInitiative(encounter.id, player.id, roll);
  }

  return (
    <section className={`pixel-panel ${theme.panel} p-4`}>
      <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
        <Swords className="h-5 w-5" />
        {encounter.name}
      </h2>

      {phase === "ROLLING" ? (
        <div className="mb-4 border-2 border-black bg-white/85 p-3 text-black">
          <p className="mb-3 text-sm font-black">Roll initiative.</p>
          <p className="mb-3 border-2 border-black bg-[#f8f4e8] p-3 text-sm font-semibold">
            Enter your initiative roll. When everyone has rolled, the turn order
            will appear here.
          </p>
          <form
            onSubmit={submitRoll}
            className="grid gap-2 border-2 border-black bg-white p-2 sm:grid-cols-[1fr_90px_auto] sm:items-end"
          >
            <div>
              <p className="font-black">{player.name}</p>
              {rolls[player.id] ? (
                <p className="text-xs uppercase">
                  Submitted: {rolls[player.id].roll}
                </p>
              ) : null}
            </div>
            <Field label="Roll" name="roll" type="number" min={0} compact />
            <button
              className={`pixel-button px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={initiativeLoading}
            >
              <BusyButtonContent
                loading={initiativeLoading}
                loadingLabel="Saving..."
              >
                Save
              </BusyButtonContent>
            </button>
          </form>
        </div>
      ) : (
        <div className="mb-4 border-2 border-black bg-white/85 p-3 text-black">
          <EncounterTurnSummary encounter={encounter} />
          <TurnInstructionCard audience="player" />
          {isCurrentPlayerTurn ? (
            <button
              type="button"
              className={`pixel-button mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
              onClick={() => onEndPlayerTurn(encounter.id, current.id)}
              disabled={endTurnLoading}
            >
              <BusyButtonContent
                loading={endTurnLoading}
                loadingLabel="Ending turn..."
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                End {current.name}'s Turn
              </BusyButtonContent>
            </button>
          ) : current?.type === "PLAYER" ? (
            <p className="mt-3 border-2 border-black bg-[#f8f4e8] p-3 text-sm font-black">
              Waiting for {current.name}.
            </p>
          ) : (
            <p className="mt-3 border-2 border-black bg-[#f8f4e8] p-3 text-sm font-black">
              DM turn.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {encounter.creatures.map((entry) => (
          <CreatureStatCard
            key={entry.id}
            creature={entry.creature}
            encounterCreature={entry}
          />
        ))}
      </div>
    </section>
  );
}

export function PlayerReferencePanel({
  isPending,
  campaignSlug,
  theme,
  chat,
  onAsk,
}: {
  isPending: PendingLookup;
  campaignSlug: string;
  theme: Record<string, string>;
  chat: KnowledgeChatResponse | null;
  onAsk: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const loading = isPending(pendingIds.askPlayerReference);
  return (
    <section className={`pixel-panel ${theme.panel} p-4`}>
      <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
        <BookOpen className="h-5 w-5" />
        Player Reference
      </h2>

      <form
        onSubmit={onAsk}
        className="mb-4 grid gap-2 lg:grid-cols-[220px_1fr_auto_auto]"
      >
        <SelectField
          label="Topic"
          name="category"
          options={playerReferenceCategories}
          defaultValue="All"
          optionLabel={(value) => playerReferenceCategoryLabels[value]}
          compact
        />
        <Field
          label="Question"
          name="question"
          placeholder="How does opportunity attack work?"
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
          disabled={loading}
        >
          <BusyButtonContent
            loading={loading}
            loadingLabel="Looking up..."
            icon={<Search className="h-4 w-4" />}
          >
            Look Up
          </BusyButtonContent>
        </button>
      </form>

      <div className="mb-4 grid max-h-64 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
        {playerReferenceCategories.map((category) => (
          <div
            key={category}
            className="border-2 border-black bg-white/85 p-3 text-sm text-black"
          >
            <p className="font-black">
              {playerReferenceCategoryLabels[category]}
            </p>
            <p className="mt-1 text-xs font-semibold">
              {playerReferenceHint(category)}
            </p>
          </div>
        ))}
      </div>

      {chat ? (
        <div className="max-h-[58vh] overflow-auto border-2 border-black bg-[#f8f4e8] p-3 text-black">
          <p className="mb-2 text-xs font-black uppercase">SRD source lookup</p>
          <pre className="whitespace-pre-wrap text-sm font-semibold leading-6">
            {chat.answer}
          </pre>
          {chat.retrievedChunks.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-black">
                Sources
              </summary>
              <div className="mt-2 grid gap-2">
                {chat.retrievedChunks.map((chunk) => (
                  <SourceResult
                    key={chunk.id}
                    result={chunk}
                    pageUrl={srdPageUrl(campaignSlug, chunk)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="border-2 border-black bg-[#f8f4e8] p-3 text-sm font-bold text-black">
          Ask about rules, classes, races, equipment, spells, adventuring,
          combat, ability scores, or anything else in the imported SRD.
        </div>
      )}
    </section>
  );
}

function srdPageUrl(
  campaignSlug: string,
  result: { sourceType: string; pageNumber?: number | null },
) {
  if (result.sourceType !== "SRD" || !result.pageNumber) {
    return undefined;
  }

  return apiUrl(
    `/api/campaigns/${campaignSlug}/player-reference/srd/pages/${result.pageNumber}/image`,
  );
}

export function playerReferenceHint(category: PlayerReferenceCategory) {
  switch (category) {
    case "All":
      return "Search across all imported player-facing SRD rules.";
    case "Attacks":
      return "Attack rolls, advantage, range, cover, and actions in combat.";
    case "AbilityScores":
      return "Ability checks, modifiers, proficiency, advantage, and contests.";
    case "AdventuringGear":
      return "Packs, kits, containers, light sources, supplies, and services.";
    case "Alignment":
      return "Alignment examples, ideals, behavior, and roleplay guidance.";
    case "Backgrounds":
      return "Background features, proficiencies, equipment, and traits.";
    case "DamageTypes":
      return "Damage, healing, resistance, vulnerability, and conditions.";
    case "Classes":
      return "Class features, levels, archetypes, spellcasting, and advancement.";
    case "Combat":
      return "Initiative, actions, reactions, cover, damage, and unconsciousness.";
    case "Conditions":
      return "Blinded, charmed, grappled, prone, restrained, and more.";
    case "Equipment":
      return "Armor, weapons, gear, packs, expenses, and carrying equipment.";
    case "Feats":
      return "Feat rules and feat descriptions when present in the SRD.";
    case "Languages":
      return "Standard languages, exotic languages, scripts, and selection.";
    case "Magic":
      return "Casting, spell slots, schools, targets, areas, and magic rules.";
    case "MountsVehicles":
      return "Mounts, tack, drawn vehicles, waterborne vehicles, and travel.";
    case "Races":
      return "Race traits, ability increases, size, speed, and languages.";
    case "SavingThrows":
      return "Saving throw timing, DCs, proficiency, and common examples.";
    case "Spells":
      return "Casting time, range, components, slots, concentration, and saves.";
    case "TimeMovement":
      return "Time, speed, travel pace, difficult terrain, jumping, and climbing.";
    case "Tools":
      return "Tool proficiencies, artisan tools, gaming sets, and instruments.";
    case "Weapons":
      return "Weapon properties, simple and martial weapons, range, and damage.";
    case "PlayInstructions":
      return "Turns, ability checks, saving throws, movement, and table basics.";
  }
}
