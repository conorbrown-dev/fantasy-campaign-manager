import {
  Archive,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  Map as MapIcon,
  Music,
  Pencil,
  Play,
  RotateCcw,
  Shield,
  Swords,
  Upload,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type {
  Asset,
  BgmPlaylist,
  Campaign,
  CampaignNote,
  CharacterSheetPayload,
  Encounter,
  EncounterCreatureStatKey,
  EncounterDraftCreature,
  KnowledgeChatResponse,
  KnowledgeDocument,
  KnowledgeSource,
  MonsterCatalogEntry,
  MonsterManualDocument,
  PendingLookup,
  Player,
  EncounterStatus,
} from "../domain";
import { formatDate, pendingIds } from "../domain";
import { BusyButtonContent, Field, PersistentTabPanel, TabBar } from "./common";
import { CampaignNotesPanel } from "./campaignNotes";
import { CharacterSheet } from "./characterSheet";
import { EncounterDraftPanel, MonsterCatalogPanel } from "./encounters";
import { KnowledgePanel } from "./knowledge";
import { BgmPlayer, BgmTrackControls, MapBoard } from "./media";
import { apiUrl } from "../api";

export function DmCommandBar({
  campaign,
  theme,
  status,
}: {
  campaign: Campaign;
  theme: Record<string, string>;
  status: string;
}) {
  return (
    <header
      className={`pixel-panel ${theme.panel} flex flex-wrap items-center justify-between gap-3 p-3 text-sm`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Shield className="h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <h1
            className={`truncate font-pixel text-xs leading-5 ${theme.primary}`}
          >
            {campaign.name}
          </h1>
          <p className="text-[11px] font-black uppercase tracking-wide">
            Campaign Manager
          </p>
        </div>
      </div>

      {status ? (
        <p className="border-2 border-black bg-white/80 p-2 text-xs font-bold text-black">
          {status}
        </p>
      ) : null}
    </header>
  );
}

export function DmWorkspace({
  isPending,
  currentCampaignMap,
  currentBgm,
  currentStoryImage,
  campaign,
  theme,
  muted,
  encounterDraft,
  onCreateEncounter,
  editingEncounterId,
  editingEncounterName,
  onEditEncounterDraft,
  onCancelEncounterDraftEdit,
  onAddMonsterToEncounterDraft,
  onRemoveMonsterFromEncounterDraft,
  onUpdateEncounterDraftCreature,
  onAddEncounterDraftCreatureKeyItem,
  onUpdateEncounterDraftCreatureKeyItem,
  onRemoveEncounterDraftCreatureKeyItem,
  onStartEncounter,
  onBeginEncounterCombat,
  onUpdateEncounterCreature,
  onSetEncounterStatus,
  onEndDmTurn,
  onResolveEncounter,
  knowledgeDocuments,
  knowledgeResults,
  knowledgeChat,
  campaignNoteResults,
  monsterManualDocuments,
  monsterCatalogResults,
  onCreateCampaignLocation,
  onCreateCampaignNote,
  onSearchCampaignNotes,
  onMoveCampaignNote,
  onUpdateCharacterSheet,
  onArchivePlayer,
  onSetPlayerMapVisible,
  onSetPlayerThemePermission,
  onUploadStoryImage,
  onSetStoryImageVisible,
  onToggleMuted,
  onUploadBgm,
  onLinkBgmTrack,
  onSetBgmTrack,
  onCreateBgmPlaylist,
  onUpdateBgmPlaylist,
  onAssignBgmTrack,
  onMoveBgmTrack,
  onUploadSfx,
  onLinkSfxTrack,
  onMoveSfxTrack,
  onUploadCampaignMap,
  onImportKnowledge,
  onImportBundledSrd,
  onSearchKnowledge,
  onAskKnowledge,
  onReindexKnowledge,
  onDeleteKnowledge,
  onImportMonsterManual,
  onImportSrdMonsterCatalog,
  onSearchMonsterCatalog,
}: {
  isPending: PendingLookup;
  currentCampaignMap?: Asset;
  currentBgm?: Asset;
  currentStoryImage?: Asset;
  campaign: Campaign;
  theme: Record<string, string>;
  muted: boolean;
  encounterDraft: EncounterDraftCreature[];
  onCreateEncounter: (event: FormEvent<HTMLFormElement>) => void;
  editingEncounterId: string;
  editingEncounterName: string;
  onEditEncounterDraft: (encounter: Encounter) => void;
  onCancelEncounterDraftEdit: () => void;
  onAddMonsterToEncounterDraft: (result: MonsterCatalogEntry) => void;
  onRemoveMonsterFromEncounterDraft: (index: number) => void;
  onUpdateEncounterDraftCreature: (
    index: number,
    field: EncounterCreatureStatKey,
    value: number,
  ) => void;
  onAddEncounterDraftCreatureKeyItem: (index: number) => void;
  onUpdateEncounterDraftCreatureKeyItem: (
    index: number,
    keyItemIndex: number,
    value: string,
  ) => void;
  onRemoveEncounterDraftCreatureKeyItem: (
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
  knowledgeDocuments: KnowledgeDocument[];
  knowledgeResults: KnowledgeSource[];
  knowledgeChat: KnowledgeChatResponse | null;
  campaignNoteResults: CampaignNote[];
  monsterManualDocuments: MonsterManualDocument[];
  monsterCatalogResults: MonsterCatalogEntry[];
  onCreateCampaignLocation: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<boolean>;
  onCreateCampaignNote: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onSearchCampaignNotes: (event: FormEvent<HTMLFormElement>) => void;
  onMoveCampaignNote: (noteId: string, direction: "up" | "down") => void;
  onUpdateCharacterSheet: (
    playerId: string,
    payload: CharacterSheetPayload,
  ) => Promise<void>;
  onArchivePlayer: (playerId: string, archived: boolean) => Promise<void>;
  onSetPlayerMapVisible: (visible: boolean) => Promise<void>;
  onSetPlayerThemePermission: (allowed: boolean) => Promise<void>;
  onUploadStoryImage: (event: FormEvent<HTMLFormElement>) => void;
  onSetStoryImageVisible: (visible: boolean) => Promise<void>;
  onToggleMuted: () => void;
  onUploadBgm: (event: FormEvent<HTMLFormElement>) => void;
  onLinkBgmTrack: (event: FormEvent<HTMLFormElement>) => void;
  onSetBgmTrack: (asset: Asset) => void;
  onCreateBgmPlaylist: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateBgmPlaylist: (
    playlistId: string,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onAssignBgmTrack: (assetId: string, playlistId?: string) => void;
  onMoveBgmTrack: (assetId: string, direction: "up" | "down") => void;
  onUploadSfx: (event: FormEvent<HTMLFormElement>) => void;
  onLinkSfxTrack: (event: FormEvent<HTMLFormElement>) => void;
  onMoveSfxTrack: (assetId: string, direction: "up" | "down") => void;
  onUploadCampaignMap: (event: FormEvent<HTMLFormElement>) => void;
  onImportKnowledge: (event: FormEvent<HTMLFormElement>) => void;
  onImportBundledSrd: () => void;
  onSearchKnowledge: (event: FormEvent<HTMLFormElement>) => void;
  onAskKnowledge: (event: FormEvent<HTMLFormElement>) => void;
  onReindexKnowledge: (documentId?: string) => void;
  onDeleteKnowledge: (documentId: string) => void;
  onImportMonsterManual: (event: FormEvent<HTMLFormElement>) => void;
  onImportSrdMonsterCatalog: () => void;
  onSearchMonsterCatalog: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    | "notes"
    | "players"
    | "reference"
    | "encounters"
    | "map"
    | "bgm"
    | "settings"
  >("notes");
  const hasActiveEncounter = Boolean(
    campaign.encounters?.some((encounter) => encounter.status === "ACTIVE"),
  );

  return (
    <div className="grid gap-3">
      <TabBar
        theme={theme}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "notes", label: "Campaign Notes" },
          { id: "players", label: "Players" },
          { id: "reference", label: "DM Reference" },
          { id: "encounters", label: "Encounters" },
          { id: "map", label: "Map" },
          { id: "bgm", label: "BGM/SFX" },
          { id: "settings", label: "Settings" },
        ]}
      />

      <PersistentTabPanel active={activeTab === "notes"}>
        <CampaignNotesPanel
          isPending={isPending}
          campaign={campaign}
          theme={theme}
          results={campaignNoteResults}
          onCreateLocation={onCreateCampaignLocation}
          onCreateNote={onCreateCampaignNote}
          onSearch={onSearchCampaignNotes}
          onMoveNote={onMoveCampaignNote}
        />
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "players"}>
        <DmPlayersPanel
          isPending={isPending}
          campaign={campaign}
          theme={theme}
          onUpdateCharacterSheet={onUpdateCharacterSheet}
          onArchivePlayer={onArchivePlayer}
        />
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "reference"}>
        <KnowledgePanel
          isPending={isPending}
          campaignSlug={campaign.slug}
          theme={theme}
          documents={knowledgeDocuments}
          results={knowledgeResults}
          chat={knowledgeChat}
          onImport={onImportKnowledge}
          onImportBundledSrd={onImportBundledSrd}
          onSearch={onSearchKnowledge}
          onAsk={onAskKnowledge}
          onReindex={onReindexKnowledge}
          onDelete={onDeleteKnowledge}
        />
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "encounters"}>
        <section className={`pixel-panel ${theme.panel} p-3`}>
          <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
            <Swords className="h-5 w-5" />
            Encounters
          </h2>
          <div className="grid gap-3">
            <EncounterDraftPanel
              isPending={isPending}
              draft={encounterDraft}
              encounters={campaign.encounters ?? []}
              theme={theme}
              onCreateEncounter={onCreateEncounter}
              editingEncounterId={editingEncounterId}
              editingEncounterName={editingEncounterName}
              onEditEncounterDraft={onEditEncounterDraft}
              onCancelEncounterDraftEdit={onCancelEncounterDraftEdit}
              onRemoveDraftMonster={onRemoveMonsterFromEncounterDraft}
              onUpdateDraftCreature={onUpdateEncounterDraftCreature}
              onAddDraftCreatureKeyItem={onAddEncounterDraftCreatureKeyItem}
              onUpdateDraftCreatureKeyItem={
                onUpdateEncounterDraftCreatureKeyItem
              }
              onRemoveDraftCreatureKeyItem={
                onRemoveEncounterDraftCreatureKeyItem
              }
              onStartEncounter={onStartEncounter}
              onBeginEncounterCombat={onBeginEncounterCombat}
              onUpdateEncounterCreature={onUpdateEncounterCreature}
              onSetEncounterStatus={onSetEncounterStatus}
              onEndDmTurn={onEndDmTurn}
              onResolveEncounter={onResolveEncounter}
            />

            {!hasActiveEncounter ? (
              <MonsterCatalogPanel
                isPending={isPending}
                theme={theme}
                documents={monsterManualDocuments}
                results={monsterCatalogResults}
                onSearch={onSearchMonsterCatalog}
                onAddToDraft={onAddMonsterToEncounterDraft}
              />
            ) : null}
          </div>
        </section>
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "map"}>
        <DmMapPanel
          isPending={isPending}
          campaign={campaign}
          theme={theme}
          currentCampaignMap={currentCampaignMap}
          currentStoryImage={currentStoryImage}
          onSetPlayerMapVisible={onSetPlayerMapVisible}
          onSetStoryImageVisible={onSetStoryImageVisible}
        />
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "bgm"}>
        <DmBgmSfxPanel
          isPending={isPending}
          campaign={campaign}
          theme={theme}
          currentBgm={currentBgm}
          muted={muted}
          onToggleMuted={onToggleMuted}
          onUploadBgm={onUploadBgm}
          onLinkBgmTrack={onLinkBgmTrack}
          onSetBgmTrack={onSetBgmTrack}
          onCreateBgmPlaylist={onCreateBgmPlaylist}
          onUpdateBgmPlaylist={onUpdateBgmPlaylist}
          onAssignBgmTrack={onAssignBgmTrack}
          onMoveBgmTrack={onMoveBgmTrack}
          onUploadSfx={onUploadSfx}
          onLinkSfxTrack={onLinkSfxTrack}
          onMoveSfxTrack={onMoveSfxTrack}
        />
      </PersistentTabPanel>

      <PersistentTabPanel active={activeTab === "settings"}>
        <DmSettingsPanel
          isPending={isPending}
          campaign={campaign}
          theme={theme}
          currentCampaignMap={currentCampaignMap}
          currentStoryImage={currentStoryImage}
          onUploadCampaignMap={onUploadCampaignMap}
          onUploadStoryImage={onUploadStoryImage}
          onSetPlayerMapVisible={onSetPlayerMapVisible}
          onSetPlayerThemePermission={onSetPlayerThemePermission}
          onSetStoryImageVisible={onSetStoryImageVisible}
          monsterManualDocuments={monsterManualDocuments}
          onImportMonsterManual={onImportMonsterManual}
          onImportSrdMonsterCatalog={onImportSrdMonsterCatalog}
        />
      </PersistentTabPanel>
    </div>
  );
}

export function DmPlayersPanel({
  isPending,
  campaign,
  theme,
  onUpdateCharacterSheet,
  onArchivePlayer,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  theme: Record<string, string>;
  onUpdateCharacterSheet: (
    playerId: string,
    payload: CharacterSheetPayload,
  ) => Promise<void>;
  onArchivePlayer: (playerId: string, archived: boolean) => Promise<void>;
}) {
  const activePlayers = campaign.players.filter((player) => !player.archivedAt);
  const archivedPlayers = campaign.players.filter(
    (player) => player.archivedAt,
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    activePlayers[0]?.id ?? campaign.players[0]?.id ?? "",
  );
  const selectedPlayer =
    campaign.players.find((player) => player.id === selectedPlayerId) ??
    activePlayers[0] ??
    campaign.players[0];

  function PlayerRow({
    player,
    archived,
  }: {
    player: Player;
    archived: boolean;
  }) {
    const loading = isPending(pendingIds.archivePlayer(player.id));
    return (
      <article className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white/90 p-3 text-black">
        <div>
          <h3 className="font-black">{player.name}</h3>
          <p className="text-xs font-black uppercase">
            {archived
              ? `Archived ${formatDate(player.archivedAt)}`
              : "Active player"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${
              selectedPlayer?.id === player.id
                ? "bg-[#ffd966] text-black"
                : "bg-white text-black"
            }`}
            onClick={() => setSelectedPlayerId(player.id)}
            title="View character sheet"
          >
            <BookOpen className="h-4 w-4" />
            Sheet
          </button>
          <button
            type="button"
            className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${
              archived ? "bg-[#bff3df] text-black" : "bg-[#ffd1dc] text-black"
            }`}
            onClick={() => onArchivePlayer(player.id, !archived)}
            title={archived ? "Restore player" : "Archive player"}
            disabled={loading}
          >
            <BusyButtonContent
              loading={loading}
              loadingLabel={archived ? "Restoring..." : "Archiving..."}
              icon={
                archived ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )
              }
            >
              {archived ? "Restore" : "Archive"}
            </BusyButtonContent>
          </button>
        </div>
      </article>
    );
  }

  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
        <UserPlus className="h-5 w-5" />
        Players
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="grid gap-2">
          <h3 className="font-pixel text-[11px] leading-5">Active</h3>
          {activePlayers.map((player) => (
            <PlayerRow key={player.id} player={player} archived={false} />
          ))}
          {!activePlayers.length ? (
            <p className="border-2 border-black bg-white/85 p-3 text-sm font-bold text-black">
              No active players.
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <h3 className="font-pixel text-[11px] leading-5">Archived</h3>
          {archivedPlayers.map((player) => (
            <PlayerRow key={player.id} player={player} archived />
          ))}
          {!archivedPlayers.length ? (
            <p className="border-2 border-black bg-white/85 p-3 text-sm font-bold text-black">
              No archived players.
            </p>
          ) : null}
        </div>
      </div>
      {selectedPlayer ? (
        <div className="mt-3 border-2 border-black bg-white/85 p-3 text-black">
          <h3 className="mb-3 flex items-center gap-2 font-pixel text-[11px] leading-5">
            <BookOpen className="h-4 w-4" />
            {selectedPlayer.name} Sheet
          </h3>
          <CharacterSheet
            key={selectedPlayer.id}
            isPending={isPending}
            player={selectedPlayer}
            history={[]}
            onSave={onUpdateCharacterSheet}
          />
        </div>
      ) : null}
    </section>
  );
}

export function DmMapPanel({
  isPending,
  campaign,
  theme,
  currentCampaignMap,
  currentStoryImage,
  onSetPlayerMapVisible,
  onSetStoryImageVisible,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  theme: Record<string, string>;
  currentCampaignMap?: Asset;
  currentStoryImage?: Asset;
  onSetPlayerMapVisible: (visible: boolean) => Promise<void>;
  onSetStoryImageVisible: (visible: boolean) => Promise<void>;
}) {
  const mapVisibilityLoading = isPending(pendingIds.togglePlayerMap);
  const storyVisibilityLoading = isPending(pendingIds.toggleStoryImage);
  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-pixel text-xs leading-5">
          <MapIcon className="h-5 w-5" />
          Map & Scene
        </h2>
        <button
          type="button"
          className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
          onClick={() =>
            onSetPlayerMapVisible(campaign.playerMapVisible === false)
          }
          disabled={mapVisibilityLoading}
          title={
            campaign.playerMapVisible === false
              ? "Show map to players"
              : "Hide map from players"
          }
        >
          <BusyButtonContent
            loading={mapVisibilityLoading}
            loadingLabel="Updating..."
            icon={
              campaign.playerMapVisible === false ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )
            }
          >
            {campaign.playerMapVisible === false ? "Show Map" : "Hide Map"}
          </BusyButtonContent>
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border-2 border-black bg-white/85 p-3 text-black">
          <h3 className="mb-2 font-pixel text-[11px] leading-5">
            Campaign Map
          </h3>
          {currentCampaignMap ? (
            <MapBoard currentCampaignMap={currentCampaignMap} />
          ) : (
            <div className="border-2 border-black bg-white p-3 text-sm font-bold">
              No campaign map selected.
            </div>
          )}
        </div>

        <div className="border-2 border-black bg-white/85 p-3 text-black">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-pixel text-[11px] leading-5">Current Scene</h3>
            <button
              type="button"
              className="pixel-button flex items-center gap-2 bg-white px-3 py-2 text-xs font-black text-black"
              onClick={() =>
                onSetStoryImageVisible(!campaign.storyImageVisible)
              }
              disabled={!currentStoryImage || storyVisibilityLoading}
              title={
                campaign.storyImageVisible
                  ? "Hide scene image from players"
                  : "Show scene image to players"
              }
            >
              <BusyButtonContent
                loading={storyVisibilityLoading}
                loadingLabel="Updating..."
                icon={
                  campaign.storyImageVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )
                }
              >
                {campaign.storyImageVisible ? "Hide" : "Show"}
              </BusyButtonContent>
            </button>
          </div>
          {currentStoryImage ? (
            <img
              className="max-h-[420px] w-full border-2 border-black object-contain"
              src={apiUrl(currentStoryImage.url)}
              alt={currentStoryImage.name}
            />
          ) : (
            <p className="border-2 border-black bg-white p-3 text-sm font-bold">
              No scene image selected.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function DmBgmSfxPanel({
  isPending,
  campaign,
  theme,
  currentBgm,
  muted,
  onToggleMuted,
  onUploadBgm,
  onLinkBgmTrack,
  onSetBgmTrack,
  onCreateBgmPlaylist,
  onUpdateBgmPlaylist,
  onAssignBgmTrack,
  onMoveBgmTrack,
  onUploadSfx,
  onLinkSfxTrack,
  onMoveSfxTrack,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  theme: Record<string, string>;
  currentBgm?: Asset;
  muted: boolean;
  onToggleMuted: () => void;
  onUploadBgm: (event: FormEvent<HTMLFormElement>) => void;
  onLinkBgmTrack: (event: FormEvent<HTMLFormElement>) => void;
  onSetBgmTrack: (asset: Asset) => void;
  onCreateBgmPlaylist: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateBgmPlaylist: (
    playlistId: string,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onAssignBgmTrack: (assetId: string, playlistId?: string) => void;
  onMoveBgmTrack: (assetId: string, direction: "up" | "down") => void;
  onUploadSfx: (event: FormEvent<HTMLFormElement>) => void;
  onLinkSfxTrack: (event: FormEvent<HTMLFormElement>) => void;
  onMoveSfxTrack: (assetId: string, direction: "up" | "down") => void;
}) {
  const bgmUploadLoading = isPending(pendingIds.uploadBgm);
  const bgmLinkLoading = isPending(pendingIds.linkBgm);
  const sfxUploadLoading = isPending(pendingIds.uploadSfx);
  const sfxLinkLoading = isPending(pendingIds.linkSfx);
  const createPlaylistLoading = isPending(pendingIds.createBgmPlaylist);
  const bgmPlaylists = normalizedBgmPlaylists(campaign);
  const sfxTracks = sortedSfxTracks(campaign);

  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
        <Music className="h-5 w-5" />
        BGM/SFX
      </h2>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-pixel text-[11px] leading-5">BGM Playlists</h3>
            <button
              type="button"
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              onClick={onToggleMuted}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              {muted ? "Muted" : "BGM On"}
            </button>
          </div>

          {currentBgm ? (
            <BgmPlayer
              asset={currentBgm}
              muted={muted}
              startedAt={campaign.bgmStartedAt}
            />
          ) : (
            <p className="border-2 border-black bg-white p-3 text-sm font-bold">
              No BGM selected.
            </p>
          )}

          <form
            onSubmit={onCreateBgmPlaylist}
            className="grid gap-2 sm:grid-cols-[1fr_auto]"
          >
            <Field label="New playlist" name="name" compact />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black sm:mt-6 ${theme.button}`}
              disabled={createPlaylistLoading}
            >
              <BusyButtonContent
                loading={createPlaylistLoading}
                loadingLabel="Creating..."
                icon={<BookOpen className="h-4 w-4" />}
              >
                Add Playlist
              </BusyButtonContent>
            </button>
          </form>

          <form onSubmit={onUploadBgm} className="grid gap-2">
            <Field
              label="Assign to playlist"
              name="playlistName"
              defaultValue="Unassigned"
              compact
            />
            <input
              name="files"
              type="file"
              accept="audio/*"
              multiple
              className="min-w-0 border-2 border-black bg-white p-2 text-xs text-black"
              required
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={bgmUploadLoading}
            >
              <BusyButtonContent
                loading={bgmUploadLoading}
                loadingLabel="Uploading..."
                icon={<Upload className="h-4 w-4" />}
              >
                Upload BGM
              </BusyButtonContent>
            </button>
          </form>

          <form onSubmit={onLinkBgmTrack} className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Track name" name="name" required={false} compact />
              <Field
                label="Assign to playlist"
                name="playlistName"
                defaultValue="Unassigned"
                compact
              />
            </div>
            <Field
              label="YouTube or Spotify URL"
              name="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              compact
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={bgmLinkLoading}
            >
              <BusyButtonContent
                loading={bgmLinkLoading}
                loadingLabel="Linking..."
                icon={<ExternalLink className="h-4 w-4" />}
              >
                Link BGM URL
              </BusyButtonContent>
            </button>
          </form>

          <div className="grid gap-3">
            {bgmPlaylists.map((playlist) => (
              <BgmPlaylistCard
                key={playlist.id}
                playlist={playlist}
                playlists={bgmPlaylists}
                theme={theme}
                currentBgmId={campaign.currentBgmAssetId}
                isPending={isPending}
                onSetBgmTrack={onSetBgmTrack}
                onUpdatePlaylist={onUpdateBgmPlaylist}
                onAssignTrack={onAssignBgmTrack}
                onMoveTrack={onMoveBgmTrack}
              />
            ))}
          </div>
        </div>

        <div className="grid content-start gap-3 border-2 border-black bg-white/85 p-3 text-black">
          <h3 className="font-pixel text-[11px] leading-5">SFX</h3>
          <form onSubmit={onUploadSfx} className="grid gap-2">
            <input
              name="files"
              type="file"
              accept="audio/*"
              multiple
              className="min-w-0 border-2 border-black bg-white p-2 text-xs text-black"
              required
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={sfxUploadLoading}
            >
              <BusyButtonContent
                loading={sfxUploadLoading}
                loadingLabel="Uploading..."
                icon={<Upload className="h-4 w-4" />}
              >
                Upload SFX
              </BusyButtonContent>
            </button>
          </form>

          <form onSubmit={onLinkSfxTrack} className="grid gap-2">
            <Field label="SFX name" name="name" required={false} compact />
            <Field
              label="YouTube or Spotify URL"
              name="url"
              type="url"
              placeholder="https://open.spotify.com/track/..."
              compact
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={sfxLinkLoading}
            >
              <BusyButtonContent
                loading={sfxLinkLoading}
                loadingLabel="Linking..."
                icon={<ExternalLink className="h-4 w-4" />}
              >
                Link SFX URL
              </BusyButtonContent>
            </button>
          </form>

          <div className="grid gap-2">
            {sfxTracks.map((track, index) => (
              <SfxTrackCard
                key={track.id}
                track={track}
                index={index}
                trackCount={sfxTracks.length}
                isPending={isPending}
                onMoveTrack={onMoveSfxTrack}
              />
            ))}
            {!sfxTracks.length ? (
              <p className="border-2 border-black bg-white p-3 text-xs font-bold">
                No SFX tracks added.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DmSettingsPanel({
  isPending,
  campaign,
  theme,
  currentCampaignMap,
  currentStoryImage,
  onUploadCampaignMap,
  onUploadStoryImage,
  onSetPlayerMapVisible,
  onSetPlayerThemePermission,
  onSetStoryImageVisible,
  monsterManualDocuments,
  onImportMonsterManual,
  onImportSrdMonsterCatalog,
}: {
  isPending: PendingLookup;
  campaign: Campaign;
  theme: Record<string, string>;
  currentCampaignMap?: Asset;
  currentStoryImage?: Asset;
  onUploadCampaignMap: (event: FormEvent<HTMLFormElement>) => void;
  onUploadStoryImage: (event: FormEvent<HTMLFormElement>) => void;
  onSetPlayerMapVisible: (visible: boolean) => Promise<void>;
  onSetPlayerThemePermission: (allowed: boolean) => Promise<void>;
  onSetStoryImageVisible: (visible: boolean) => Promise<void>;
  monsterManualDocuments: MonsterManualDocument[];
  onImportMonsterManual: (event: FormEvent<HTMLFormElement>) => void;
  onImportSrdMonsterCatalog: () => void;
}) {
  const mapUploadLoading = isPending(pendingIds.uploadCampaignMap);
  const storyUploadLoading = isPending(pendingIds.uploadStoryImage);
  const mapVisibilityLoading = isPending(pendingIds.togglePlayerMap);
  const themePermissionLoading = isPending(pendingIds.togglePlayerTheme);
  const storyVisibilityLoading = isPending(pendingIds.toggleStoryImage);
  const importSrdLoading = isPending(pendingIds.importSrdMonsterCatalog);
  const importManualLoading = isPending(pendingIds.importMonsterManual);
  const hasSrdCatalog = monsterManualDocuments.some(
    (document) =>
      document.originalFileName === "SRD_CC_v5.1.pdf" &&
      document.entryCount > 0,
  );
  return (
    <section className={`pixel-panel ${theme.panel} p-3`}>
      <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
        <Shield className="h-5 w-5" />
        Settings
      </h2>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black">
          <h3 className="font-pixel text-[11px] leading-5">Player Options</h3>
          <button
            type="button"
            className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
            onClick={() =>
              onSetPlayerThemePermission(!campaign.allowPlayerTheme)
            }
            disabled={themePermissionLoading}
          >
            <BusyButtonContent
              loading={themePermissionLoading}
              loadingLabel="Updating..."
              icon={
                campaign.allowPlayerTheme ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )
              }
            >
              {campaign.allowPlayerTheme
                ? "Disable Player Themes"
                : "Allow Player Themes"}
            </BusyButtonContent>
          </button>
        </div>

        <div className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-pixel text-[11px] leading-5">Campaign Map</h3>
            <button
              type="button"
              className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              onClick={() =>
                onSetPlayerMapVisible(campaign.playerMapVisible === false)
              }
              disabled={mapVisibilityLoading}
              title={
                campaign.playerMapVisible === false
                  ? "Show map to players"
                  : "Hide map from players"
              }
            >
              <BusyButtonContent
                loading={mapVisibilityLoading}
                loadingLabel="Updating..."
                icon={
                  campaign.playerMapVisible === false ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )
                }
              >
                {campaign.playerMapVisible === false ? "Show Map" : "Hide Map"}
              </BusyButtonContent>
            </button>
          </div>
          <p className="border-2 border-black bg-white p-2 text-xs font-bold">
            {currentCampaignMap ? currentCampaignMap.name : "No map selected."}
          </p>
          <form onSubmit={onUploadCampaignMap} className="grid gap-2">
            <input type="hidden" name="kind" value="CampaignMap" />
            <input
              name="file"
              type="file"
              accept="image/*"
              className="min-w-0 border-2 border-black bg-white p-2 text-xs text-black"
              required
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={mapUploadLoading}
            >
              <BusyButtonContent
                loading={mapUploadLoading}
                loadingLabel="Uploading..."
                icon={<Upload className="h-4 w-4" />}
              >
                Upload Map
              </BusyButtonContent>
            </button>
          </form>
        </div>

        <div className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-pixel text-[11px] leading-5">Scene Image</h3>
            <button
              type="button"
              className={`pixel-button flex items-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              onClick={() =>
                onSetStoryImageVisible(!campaign.storyImageVisible)
              }
              disabled={!currentStoryImage || storyVisibilityLoading}
              title={
                campaign.storyImageVisible
                  ? "Hide scene image from players"
                  : "Show scene image to players"
              }
            >
              <BusyButtonContent
                loading={storyVisibilityLoading}
                loadingLabel="Updating..."
                icon={
                  campaign.storyImageVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )
                }
              >
                {campaign.storyImageVisible ? "Hide Scene" : "Show Scene"}
              </BusyButtonContent>
            </button>
          </div>
          <p className="border-2 border-black bg-white p-2 text-xs font-bold">
            {currentStoryImage ? currentStoryImage.name : "No scene selected."}
          </p>
          <form onSubmit={onUploadStoryImage} className="grid gap-2">
            <input type="hidden" name="kind" value="StoryImage" />
            <input
              name="file"
              type="file"
              accept="image/*"
              className="min-w-0 border-2 border-black bg-white p-2 text-xs text-black"
              required
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={storyUploadLoading}
            >
              <BusyButtonContent
                loading={storyUploadLoading}
                loadingLabel="Uploading..."
                icon={<Upload className="h-4 w-4" />}
              >
                Upload Scene
              </BusyButtonContent>
            </button>
          </form>
        </div>

        <div className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-pixel text-[11px] leading-5">
              <BookOpen className="h-4 w-4" />
              Monster Catalog Imports
            </h3>
            <p className="text-[11px] font-black uppercase">
              {monsterManualDocuments.reduce(
                (total, document) => total + document.entryCount,
                0,
              )}{" "}
              entries
            </p>
          </div>
          <button
            type="button"
            className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
            onClick={onImportSrdMonsterCatalog}
            disabled={importSrdLoading}
          >
            <BusyButtonContent
              loading={importSrdLoading}
              loadingLabel="Importing SRD..."
              icon={<BookOpen className="h-4 w-4" />}
            >
              {hasSrdCatalog ? "SRD Monsters Ready" : "Import SRD Monsters"}
            </BusyButtonContent>
          </button>
          <form onSubmit={onImportMonsterManual} className="grid gap-2">
            <Field label="Manual title" name="title" required={false} compact />
            <input
              name="file"
              type="file"
              accept=".pdf,application/pdf"
              className="w-full border-2 border-black bg-white p-2 text-xs"
              required
            />
            <button
              className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
              disabled={importManualLoading}
            >
              <BusyButtonContent
                loading={importManualLoading}
                loadingLabel="Importing..."
                icon={<Upload className="h-4 w-4" />}
              >
                Import Manual
              </BusyButtonContent>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function BgmPlaylistCard({
  playlist,
  playlists,
  theme,
  currentBgmId,
  isPending,
  onSetBgmTrack,
  onUpdatePlaylist,
  onAssignTrack,
  onMoveTrack,
}: {
  playlist: BgmPlaylist;
  playlists: BgmPlaylist[];
  theme: Record<string, string>;
  currentBgmId?: string | null;
  isPending: PendingLookup;
  onSetBgmTrack: (asset: Asset) => void;
  onUpdatePlaylist: (
    playlistId: string,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onAssignTrack: (assetId: string, playlistId?: string) => void;
  onMoveTrack: (assetId: string, direction: "up" | "down") => void;
}) {
  const updateLoading = isPending(pendingIds.updateBgmPlaylist(playlist.id));

  return (
    <article className="border-2 border-black bg-white p-3 text-black">
      <form
        onSubmit={(event) => onUpdatePlaylist(playlist.id, event)}
        className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]"
      >
        <Field
          label="Playlist name"
          name="name"
          defaultValue={playlist.name}
          compact
        />
        <button
          className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black sm:mt-6 ${theme.button}`}
          disabled={updateLoading}
        >
          <BusyButtonContent
            loading={updateLoading}
            loadingLabel="Saving..."
            icon={<Pencil className="h-4 w-4" />}
          >
            Rename
          </BusyButtonContent>
        </button>
      </form>

      <div className="grid gap-2">
        {playlist.tracks.map((track, index) => {
          const setLoading = isPending(pendingIds.setBgmTrack(track.id));
          const moveUpLoading = isPending(
            pendingIds.moveBgmTrack(track.id, "up"),
          );
          const moveDownLoading = isPending(
            pendingIds.moveBgmTrack(track.id, "down"),
          );
          const assignLoading = isPending(pendingIds.assignBgmTrack(track.id));
          return (
            <div
              key={track.id}
              className="grid gap-2 border-2 border-black bg-[#f8f4e8] p-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-black">
                    {track.name}
                    {currentBgmId === track.id ? " - Playing at table" : ""}
                  </p>
                  <p className="truncate uppercase">{track.mimeType}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
                    onClick={() => onMoveTrack(track.id, "up")}
                    disabled={index === 0 || moveUpLoading}
                    title="Move track up"
                  >
                    <BusyButtonContent
                      loading={moveUpLoading}
                      icon={<ChevronUp className="h-4 w-4" />}
                    >
                      <span className="sr-only">Move up</span>
                    </BusyButtonContent>
                  </button>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
                    onClick={() => onMoveTrack(track.id, "down")}
                    disabled={
                      index === playlist.tracks.length - 1 || moveDownLoading
                    }
                    title="Move track down"
                  >
                    <BusyButtonContent
                      loading={moveDownLoading}
                      icon={<ChevronDown className="h-4 w-4" />}
                    >
                      <span className="sr-only">Move down</span>
                    </BusyButtonContent>
                  </button>
                </div>
              </div>
              <BgmTrackControls asset={track} />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="block text-xs font-black uppercase">
                  Playlist
                  <select
                    value={track.bgmPlaylistId ?? ""}
                    className="mt-1 w-full border-2 border-black bg-white p-2 text-xs text-black"
                    disabled={assignLoading}
                    onChange={(event) =>
                      onAssignTrack(
                        track.id,
                        event.currentTarget.value || undefined,
                      )
                    }
                  >
                    {playlists.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black sm:mt-5 ${theme.button}`}
                  onClick={() => onSetBgmTrack(track)}
                  disabled={setLoading}
                >
                  <BusyButtonContent
                    loading={setLoading}
                    loadingLabel="Starting..."
                    icon={<Play className="h-4 w-4" />}
                  >
                    Play at Table
                  </BusyButtonContent>
                </button>
              </div>
            </div>
          );
        })}
        {!playlist.tracks.length ? (
          <p className="border-2 border-black bg-white p-3 text-xs font-bold">
            No tracks in this playlist.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SfxTrackCard({
  track,
  index,
  trackCount,
  isPending,
  onMoveTrack,
}: {
  track: Asset;
  index: number;
  trackCount: number;
  isPending: PendingLookup;
  onMoveTrack: (assetId: string, direction: "up" | "down") => void;
}) {
  const moveUpLoading = isPending(pendingIds.moveSfxTrack(track.id, "up"));
  const moveDownLoading = isPending(pendingIds.moveSfxTrack(track.id, "down"));

  return (
    <div className="grid gap-2 border-2 border-black bg-[#f8f4e8] p-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-black">{track.name}</p>
          <p className="truncate uppercase">{track.mimeType}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
            onClick={() => onMoveTrack(track.id, "up")}
            disabled={index === 0 || moveUpLoading}
            title="Move SFX up"
          >
            <BusyButtonContent
              loading={moveUpLoading}
              icon={<ChevronUp className="h-4 w-4" />}
            >
              <span className="sr-only">Move up</span>
            </BusyButtonContent>
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center border-2 border-black bg-white"
            onClick={() => onMoveTrack(track.id, "down")}
            disabled={index === trackCount - 1 || moveDownLoading}
            title="Move SFX down"
          >
            <BusyButtonContent
              loading={moveDownLoading}
              icon={<ChevronDown className="h-4 w-4" />}
            >
              <span className="sr-only">Move down</span>
            </BusyButtonContent>
          </button>
        </div>
      </div>
      <BgmTrackControls asset={track} />
    </div>
  );
}

function normalizedBgmPlaylists(campaign: Campaign): BgmPlaylist[] {
  const playlists = [...(campaign.bgmPlaylists ?? [])].map((playlist) => ({
    ...playlist,
    tracks: [...playlist.tracks].sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        (left.createdAt ?? "").localeCompare(right.createdAt ?? ""),
    ),
  }));
  const assignedTrackIds = new Set(
    playlists.flatMap((playlist) => playlist.tracks.map((track) => track.id)),
  );
  const looseTracks = (campaign.assets ?? []).filter(
    (asset) =>
      asset.kind === "BGM" &&
      !asset.bgmPlaylistId &&
      !assignedTrackIds.has(asset.id),
  );

  if (!playlists.length || looseTracks.length) {
    const unassigned = playlists.find(
      (playlist) => playlist.name === "Unassigned",
    );
    if (unassigned) {
      unassigned.tracks = [...unassigned.tracks, ...looseTracks];
    } else {
      playlists.unshift({
        id: "",
        campaignId: campaign.id,
        name: "Unassigned",
        sortOrder: 0,
        tracks: looseTracks,
      });
    }
  }

  return playlists.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function sortedSfxTracks(campaign: Campaign) {
  return (campaign.assets ?? [])
    .filter((asset) => asset.kind === "SFX")
    .sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        (left.createdAt ?? "").localeCompare(right.createdAt ?? ""),
    );
}
