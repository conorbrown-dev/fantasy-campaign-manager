import React, { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { Shield, Volume2, VolumeX } from "lucide-react";
import { apiUrl, socketOrigin } from "./api";
import { CampaignCreator, DmLogin, PlayerJoin } from "./components/auth";
import { DmCommandBar, DmWorkspace } from "./components/dm";
import { BgmPlayer } from "./components/media";
import { PlayerWelcome, PlayerWorkspace } from "./components/player";
import type {
  Asset,
  Campaign,
  CampaignNote,
  CharacterSheetHistoryEntry,
  CharacterSheetPayload,
  Encounter,
  EncounterCreatureStatKey,
  EncounterDraftCreature,
  EncounterStatus,
  KnowledgeChatResponse,
  KnowledgeDocument,
  KnowledgeSource,
  MonsterCatalogEntry,
  MonsterManualDocument,
  Player,
} from "./domain";
import {
  minimumBundledSrdMonsterEntries,
  pendingIds,
  splitList,
  themeClasses,
} from "./domain";
import "./main.css";

const socket = io(socketOrigin(), { autoConnect: false });

function getSlugFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);

  return {
    slug: parts[0] ?? "",
    isDm: parts[1]?.toLowerCase() === "campaignmanager",
  };
}

function App() {
  const route = useMemo(getSlugFromPath, []);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [dmToken, setDmToken] = useState(
    localStorage.getItem(`dm:${route.slug}`) ?? "",
  );
  const [playerId, setPlayerId] = useState(
    localStorage.getItem(`player:${route.slug}`) ?? "",
  );
  const [muted, setMuted] = useState(false);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<
    KnowledgeDocument[]
  >([]);
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSource[]>(
    [],
  );
  const [knowledgeChat, setKnowledgeChat] =
    useState<KnowledgeChatResponse | null>(null);
  const [playerReferenceChat, setPlayerReferenceChat] =
    useState<KnowledgeChatResponse | null>(null);
  const [monsterCatalogResults, setMonsterCatalogResults] = useState<
    MonsterCatalogEntry[]
  >([]);
  const [encounterDraft, setEncounterDraft] = useState<
    EncounterDraftCreature[]
  >([]);
  const [editingEncounterId, setEditingEncounterId] = useState("");
  const [editingEncounterName, setEditingEncounterName] = useState("");
  const [monsterManualDocuments, setMonsterManualDocuments] = useState<
    MonsterManualDocument[]
  >([]);
  const [campaignNoteResults, setCampaignNoteResults] = useState<
    CampaignNote[]
  >([]);
  const [characterSheetHistory, setCharacterSheetHistory] = useState<
    CharacterSheetHistoryEntry[]
  >([]);
  const [knowledgeDocumentsLoaded, setKnowledgeDocumentsLoaded] =
    useState(false);
  const [autoSrdImportAttempted, setAutoSrdImportAttempted] = useState(false);
  const [monsterManualsLoaded, setMonsterManualsLoaded] = useState(false);
  const [autoSrdMonsterImportAttempted, setAutoSrdMonsterImportAttempted] =
    useState(false);
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(
    new Set(),
  );
  const [status, setStatus] = useState("");

  const currentPlayer = campaign?.players.find(
    (player) => player.id === playerId,
  );
  const activeThemeKey =
    !route.isDm && campaign?.allowPlayerTheme && currentPlayer?.theme
      ? currentPlayer.theme
      : (campaign?.theme ?? (route.isDm ? "DM_FORGE" : "PURPLE_LILAC"));
  const theme =
    themeClasses[activeThemeKey] ??
    themeClasses[route.isDm ? "DM_FORGE" : "PURPLE_LILAC"];
  const currentBgm = campaign?.assets?.find(
    (asset) => asset.id === campaign.currentBgmAssetId,
  );
  const currentCampaignMap = campaign?.assets?.find(
    (asset) => asset.id === campaign.currentCampaignMapAssetId,
  );
  const currentStoryImage = campaign?.assets?.find(
    (asset) => asset.id === campaign.currentStoryImageAssetId,
  );
  function isPending(actionId: string) {
    return pendingActionIds.has(actionId);
  }

  async function trackPending<T>(actionId: string, task: () => Promise<T>) {
    setPendingActionIds((current) => new Set(current).add(actionId));
    try {
      return await task();
    } finally {
      setPendingActionIds((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  async function loadCampaign() {
    if (!route.slug) return;
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}${route.isDm ? "/dm" : ""}`),
      {
        headers: dmToken ? { Authorization: `Bearer ${dmToken}` } : undefined,
      },
    );
    if (response.ok) {
      setCampaign(await response.json());
      socket.connect();
      socket.emit("campaign:join", { slug: route.slug });
      setStatus("");
    } else {
      setStatus(
        route.isDm
          ? "Unlock the Campaign Manager with the DM password."
          : "Campaign not found yet.",
      );
    }
  }

  async function loadCharacterSheetHistory(activePlayerId = playerId) {
    if (!activePlayerId) return;
    const response = await fetch(
      apiUrl(`/api/players/${activePlayerId}/sheet/history`),
    );
    if (response.ok) {
      setCharacterSheetHistory(await response.json());
    }
  }

  async function loadKnowledgeDocuments() {
    if (!route.slug || !route.isDm || !dmToken) return;
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/documents`),
      {
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );
    if (response.ok) {
      setKnowledgeDocuments(await response.json());
      setKnowledgeDocumentsLoaded(true);
    }
  }

  async function loadMonsterManuals() {
    if (!route.slug || !route.isDm || !dmToken) return;
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/monster-manuals`),
      {
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );
    if (response.ok) {
      setMonsterManualDocuments(await response.json());
      setMonsterManualsLoaded(true);
    }
  }

  React.useEffect(() => {
    void loadCampaign();
  }, [dmToken]);

  React.useEffect(() => {
    if (currentPlayer) {
      void loadCharacterSheetHistory(currentPlayer.id);
    } else {
      setCharacterSheetHistory([]);
    }
  }, [currentPlayer?.id]);

  React.useEffect(() => {
    void loadKnowledgeDocuments();
    void loadMonsterManuals();
  }, [dmToken]);

  React.useEffect(() => {
    const hasBundledSrd = knowledgeDocuments.some(
      (document) =>
        document.sourceType === "SRD" &&
        document.originalFileName === "SRD_CC_v5.1.pdf",
    );

    if (
      route.isDm &&
      campaign &&
      dmToken &&
      knowledgeDocumentsLoaded &&
      !autoSrdImportAttempted &&
      !hasBundledSrd
    ) {
      setAutoSrdImportAttempted(true);
      setStatus("Importing SRD 5.1 as the default rules source...");
      void importBundledSrd();
    }
  }, [
    autoSrdImportAttempted,
    campaign,
    dmToken,
    knowledgeDocuments,
    knowledgeDocumentsLoaded,
    route.isDm,
  ]);

  React.useEffect(() => {
    const hasBundledSrdMonsterCatalog = monsterManualDocuments.some(
      (document) =>
        document.originalFileName === "SRD_CC_v5.1.pdf" &&
        document.entryCount >= minimumBundledSrdMonsterEntries,
    );

    if (
      route.isDm &&
      campaign &&
      dmToken &&
      monsterManualsLoaded &&
      !autoSrdMonsterImportAttempted &&
      !hasBundledSrdMonsterCatalog
    ) {
      setAutoSrdMonsterImportAttempted(true);
      setStatus("Importing SRD 5.1 as the default monster reference...");
      void importSrdMonsterCatalog();
    }
  }, [
    autoSrdMonsterImportAttempted,
    campaign,
    dmToken,
    monsterManualDocuments,
    monsterManualsLoaded,
    route.isDm,
  ]);

  React.useEffect(() => {
    function handleBgmSync(payload: { asset: Asset; startedAt: string }) {
      setCampaign((current) => {
        if (!current) return current;
        const assets = current.assets?.some(
          (asset) => asset.id === payload.asset.id,
        )
          ? current.assets
          : [...(current.assets ?? []), payload.asset];

        return {
          ...current,
          assets,
          currentBgmAssetId: payload.asset.id,
          bgmStartedAt: payload.startedAt,
        };
      });
    }

    socket.on("bgm:sync", handleBgmSync);
    return () => {
      socket.off("bgm:sync", handleBgmSync);
    };
  }, []);

  React.useEffect(() => {
    function handleCampaignMapSync(payload: { asset: Asset; setAt: string }) {
      setCampaign((current) => {
        if (!current) return current;
        const assets = current.assets?.some(
          (asset) => asset.id === payload.asset.id,
        )
          ? current.assets
          : [...(current.assets ?? []), payload.asset];

        return {
          ...current,
          assets,
          currentCampaignMapAssetId: payload.asset.id,
          campaignMapSetAt: payload.setAt,
        };
      });
    }

    socket.on("campaignMap:sync", handleCampaignMapSync);
    return () => {
      socket.off("campaignMap:sync", handleCampaignMapSync);
    };
  }, []);

  React.useEffect(() => {
    function handleEncounterSync() {
      void loadCampaign();
    }

    socket.on("encounter:sync", handleEncounterSync);
    return () => {
      socket.off("encounter:sync", handleEncounterSync);
    };
  }, [dmToken]);

  React.useEffect(() => {
    function handleCampaignSync() {
      void loadCampaign();
    }

    socket.on("campaign:sync", handleCampaignSync);
    return () => {
      socket.off("campaign:sync", handleCampaignSync);
    };
  }, [dmToken]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(apiUrl("/api/campaigns"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        dmPassword: data.get("password"),
        theme: data.get("theme"),
      }),
    });

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not create that campaign."),
      );
      return;
    }

    const created = await response.json();

    if (!created.slug) {
      setStatus(
        "The campaign was created, but the server did not return a campaign URL.",
      );
      return;
    }

    window.history.replaceState(null, "", `/${created.slug}`);
    window.location.reload();
  }

  async function loginDm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/dm/login`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      },
    );
    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem(`dm:${route.slug}`, token);
      setDmToken(token);
    } else {
      setStatus("That password did not open the gate.");
    }
  }

  async function createPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/players`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          accessCode: data.get("accessCode"),
        }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not join campaign."));
      return;
    }

    const player: Player = await response.json();
    localStorage.setItem(`player:${route.slug}`, player.id);
    setPlayerId(player.id);
    form.reset();
    await loadCampaign();
  }

  async function createEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const creatures = encounterDraft
      .filter((entry) => Boolean(entry.creatureId))
      .map((entry) => ({
        creatureId: entry.creatureId,
        armorClass: entry.armorClass,
        maxHitPoints: entry.maxHitPoints,
        currentHp: entry.currentHp,
        speed: entry.speed,
        initiative: entry.initiative,
        strength: entry.strength,
        dexterity: entry.dexterity,
        constitution: entry.constitution,
        intelligence: entry.intelligence,
        wisdom: entry.wisdom,
        charisma: entry.charisma,
        keyItems: entry.keyItems,
      }));

    if (!creatures.length) {
      setStatus("Add at least one catalog monster to the encounter draft.");
      return;
    }

    const editing = Boolean(editingEncounterId);
    const response = await fetch(
      apiUrl(
        editing
          ? `/api/campaigns/${route.slug}/encounters/${editingEncounterId}`
          : `/api/campaigns/${route.slug}/encounters`,
      ),
      {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          name: data.get("name"),
          creatures,
          status: data.get("status") === "DRAFT" ? "DRAFT" : "PENDING",
        }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not prepare encounter."));
      return;
    }

    setEncounterDraft([]);
    setEditingEncounterId("");
    setEditingEncounterName("");
    form.reset();
    await loadCampaign();
  }

  function addMonsterToEncounterDraft(result: MonsterCatalogEntry) {
    if (!result.creatureId) {
      setStatus("That catalog entry is missing a creature record.");
      return;
    }

    setEncounterDraft((current) => [
      ...current,
      {
        ...result,
        armorClass: result.armorClass ?? 10,
        maxHitPoints: result.hitPoints ?? 1,
        currentHp: result.hitPoints ?? 1,
        speed: 30,
        initiative: 0,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        keyItems: [],
      },
    ]);
  }

  function editEncounterDraft(encounter: Encounter) {
    setEditingEncounterId(encounter.id);
    setEditingEncounterName(encounter.name);
    setEncounterDraft(
      encounter.creatures.map((entry) => ({
        id: entry.id,
        creatureId: entry.creature.id,
        name: entry.creature.name,
        pageNumber: 0,
        pageImageUrl: entry.creature.imageUrl ?? "",
        sizeType: entry.creature.preferredEnvironment,
        armorClass: entry.armorClass ?? entry.creature.armorClass ?? 10,
        hitPoints: entry.creature.hitPoints,
        maxHitPoints: entry.maxHitPoints ?? entry.creature.hitPoints ?? 1,
        currentHp:
          entry.currentHp ??
          entry.maxHitPoints ??
          entry.creature.hitPoints ??
          1,
        speed: entry.speed ?? 30,
        initiative: entry.initiative ?? 0,
        strength: entry.strength ?? 10,
        dexterity: entry.dexterity ?? 10,
        constitution: entry.constitution ?? 10,
        intelligence: entry.intelligence ?? 10,
        wisdom: entry.wisdom ?? 10,
        charisma: entry.charisma ?? 10,
        challengeRating: null,
        sourceName: "Saved encounter",
        textPreview: "",
        relevanceScore: 0,
        keyItems: entry.keyItems ?? [],
      })),
    );
  }

  function cancelEncounterDraftEdit() {
    setEditingEncounterId("");
    setEditingEncounterName("");
    setEncounterDraft([]);
  }

  function removeMonsterFromEncounterDraft(index: number) {
    setEncounterDraft((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function updateEncounterDraftCreature(
    index: number,
    field: EncounterCreatureStatKey,
    value: number,
  ) {
    setEncounterDraft((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function addEncounterDraftCreatureKeyItem(index: number) {
    setEncounterDraft((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? { ...entry, keyItems: [...entry.keyItems, ""] }
          : entry,
      ),
    );
  }

  function updateEncounterDraftCreatureKeyItem(
    index: number,
    keyItemIndex: number,
    value: string,
  ) {
    setEncounterDraft((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              keyItems: entry.keyItems.map((item, currentKeyItemIndex) =>
                currentKeyItemIndex === keyItemIndex ? value : item,
              ),
            }
          : entry,
      ),
    );
  }

  function removeEncounterDraftCreatureKeyItem(
    index: number,
    keyItemIndex: number,
  ) {
    setEncounterDraft((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              keyItems: entry.keyItems.filter(
                (_, currentKeyItemIndex) =>
                  currentKeyItemIndex !== keyItemIndex,
              ),
            }
          : entry,
      ),
    );
  }

  async function startEncounter(encounterId: string) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/encounters/${encounterId}/start`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not start encounter."));
      return;
    }

    await loadCampaign();
  }

  async function setEncounterStatus(
    encounterId: string,
    encounterStatus: EncounterStatus,
  ) {
    const response = await fetch(
      apiUrl(
        `/api/campaigns/${route.slug}/encounters/${encounterId}/status`,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ status: encounterStatus }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update encounter status."),
      );
      return;
    }

    await loadCampaign();
  }

  async function endDmTurn(encounterId: string) {
    const response = await fetch(
      apiUrl(
        `/api/campaigns/${route.slug}/encounters/${encounterId}/dm/end-turn`,
      ),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not end DM turn."));
      return;
    }

    await loadCampaign();
  }

  async function beginEncounterCombat(encounterId: string) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/encounters/${encounterId}/begin`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not begin combat."));
      return;
    }

    await loadCampaign();
  }

  async function updateEncounterCreature(
    encounterId: string,
    encounterCreatureId: string,
    payload: Partial<Record<EncounterCreatureStatKey, number>>,
  ) {
    const response = await fetch(
      apiUrl(
        `/api/campaigns/${route.slug}/encounters/${encounterId}/creatures/${encounterCreatureId}`,
      ),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update encounter creature."),
      );
      return;
    }

    await loadCampaign();
  }

  async function resolveEncounter(encounterId: string) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/encounters/${encounterId}/resolve`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not archive encounter."));
      return;
    }

    await loadCampaign();
  }

  async function submitInitiative(
    encounterId: string,
    playerId: string,
    roll: number,
  ) {
    const response = await fetch(
      apiUrl(
        `/api/campaigns/${route.slug}/encounters/${encounterId}/players/${playerId}/initiative`,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roll }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not submit initiative."));
      return;
    }

    await loadCampaign();
  }

  async function endPlayerTurn(encounterId: string, playerId: string) {
    const response = await fetch(
      apiUrl(
        `/api/campaigns/${route.slug}/encounters/${encounterId}/players/${playerId}/end-turn`,
      ),
      { method: "POST" },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not end player turn."));
      return;
    }

    await loadCampaign();
  }

  async function importMonsterManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("Importing monster manual catalog...");

    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/monster-manuals/upload`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
        body: data,
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not import that monster manual."),
      );
      return;
    }

    const document: MonsterManualDocument = await response.json();
    setStatus(`Imported ${document.entryCount} monster catalog entries.`);
    form.reset();
    await loadMonsterManuals();
  }

  async function importSrdMonsterCatalog() {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/monster-catalog/import-srd`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(
          response,
          "Could not import the SRD monster catalog.",
        ),
      );
      return;
    }

    const document: MonsterManualDocument = await response.json();
    setStatus(`Imported ${document.entryCount} SRD monster catalog entries.`);
    await loadMonsterManuals();
  }

  async function searchMonsterCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      q: String(data.get("q") ?? ""),
    });
    if (data.get("wholeWords") === "true") {
      params.set("wholeWords", "true");
    }
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/monster-catalog?${params}`),
      {
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (response.ok) {
      setMonsterCatalogResults(await response.json());
    } else {
      setStatus(
        await formatApiError(response, "Monster catalog search failed."),
      );
    }
  }

  async function uploadBgm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const upload = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/tracks/upload`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
        body: data,
      },
    );

    if (!upload.ok) {
      setStatus(
        await formatApiError(upload, "Could not upload that BGM track."),
      );
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function linkBgmTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/tracks/link`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          name: data.get("name"),
          url: data.get("url"),
          playlistName: data.get("playlistName"),
        }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not link that BGM URL."));
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function uploadSfx(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const upload = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/sfx/tracks/upload`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
        body: data,
      },
    );

    if (!upload.ok) {
      setStatus(
        await formatApiError(upload, "Could not upload that SFX track."),
      );
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function linkSfxTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/sfx/tracks/link`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          name: data.get("name"),
          url: data.get("url"),
        }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not link that SFX URL."));
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function setBgmTrack(asset: Asset) {
    const bgm = await fetch(apiUrl(`/api/campaigns/${route.slug}/bgm`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dmToken}`,
      },
      body: JSON.stringify({ assetId: asset.id }),
    });

    if (!bgm.ok) {
      setStatus(await formatApiError(bgm, "Could not set that BGM track."));
      return;
    }

    const updatedCampaign: Campaign = await bgm.json();
    const startedAt = updatedCampaign.bgmStartedAt ?? new Date().toISOString();

    socket.emit("bgm:sync", {
      slug: route.slug,
      asset,
      assetUrl: publicAssetUrl(asset.url),
      startedAt,
    });
    await loadCampaign();
  }

  async function createBgmPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/playlists`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ name: data.get("name") }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not create playlist."));
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function updateBgmPlaylist(
    playlistId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/playlists/${playlistId}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ name: data.get("name") }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not rename playlist."));
      return;
    }

    await loadCampaign();
  }

  async function assignBgmTrack(assetId: string, playlistId?: string) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/tracks/${assetId}/playlist`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ playlistId }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not move that track."));
      return;
    }

    await loadCampaign();
  }

  async function moveBgmTrack(assetId: string, direction: "up" | "down") {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/bgm/tracks/${assetId}/move`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ direction }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not reorder that track."),
      );
      return;
    }

    await loadCampaign();
  }

  async function moveSfxTrack(assetId: string, direction: "up" | "down") {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/sfx/tracks/${assetId}/move`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ direction }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not reorder that SFX."));
      return;
    }

    await loadCampaign();
  }

  async function setPlayerThemePermission(allowed: boolean) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/player-theme-permission`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ allowed }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update player themes."),
      );
      return;
    }

    await loadCampaign();
  }

  async function updatePlayerTheme(themeKey: string) {
    if (!currentPlayer) return;
    const response = await fetch(
      apiUrl(`/api/players/${currentPlayer.id}/theme`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeKey }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not update your theme."));
      return;
    }

    await loadCampaign();
  }

  async function uploadCampaignMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const upload = await fetch(
        apiUrl(`/api/campaigns/${route.slug}/assets/upload`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${dmToken}` },
          body: data,
        },
      );

      if (!upload.ok) {
        setStatus(
          await formatApiError(upload, "Could not upload that campaign map."),
        );
        return;
      }

      const asset: Asset = await upload.json();

      const campaignMap = await fetch(
        apiUrl(`/api/campaigns/${route.slug}/campaignMap`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${dmToken}`,
          },
          body: JSON.stringify({ assetId: asset.id }),
        },
      );

      if (!campaignMap.ok) {
        setStatus(
          await formatApiError(campaignMap, "Could not set that campaign map."),
        );
        return;
      }

      const startedAt = new Date().toISOString();
      socket.emit("campaignMap:sync", {
        slug: route.slug,
        asset,
        assetUrl: apiUrl(asset.url),
        startedAt,
      });
      form.reset();
      await loadCampaign();
    } catch (error) {
      console.error("error: ", error);
    }
  }

  async function setPlayerMapVisible(visible: boolean) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/player-map-visibility`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ visible }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update map visibility."),
      );
      return;
    }

    await loadCampaign();
  }

  async function uploadStoryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const upload = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/assets/upload`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
        body: data,
      },
    );

    if (!upload.ok) {
      setStatus(await formatApiError(upload, "Could not upload that image."));
      return;
    }

    const asset: Asset = await upload.json();
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/story-image`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ assetId: asset.id }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not show that image."));
      return;
    }

    form.reset();
    await loadCampaign();
  }

  async function setStoryImageVisible(visible: boolean) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/story-image-visibility`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ visible }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update image visibility."),
      );
      return;
    }

    await loadCampaign();
  }

  async function archivePlayer(playerId: string, archived: boolean) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/players/${playerId}/archive`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ archived }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not update that player."),
      );
      return;
    }

    await loadCampaign();
  }

  async function createCampaignLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const locationId = String(data.get("locationId") ?? "");
    const sortOrder = Number(data.get("sortOrder"));
    const description = String(data.get("description") ?? "")
      .split("\n")
      .map((text, index) => ({ sortOrder: index, text: text.trim() }))
      .filter((entry) => entry.text);

    const response = await fetch(
      apiUrl(
        locationId
          ? `/api/campaigns/${route.slug}/locations/${locationId}`
          : `/api/campaigns/${route.slug}/locations`,
      ),
      {
        method: locationId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          name: data.get("name"),
          description,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        }),
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not save location."));
      return false;
    }

    form.reset();
    await loadCampaign();
    return true;
  }

  async function createCampaignNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const attachmentTypes = data
      .getAll("attachmentType")
      .map((value) => String(value));
    const attachmentNames = data
      .getAll("attachmentName")
      .map((value) => String(value).trim());
    const attachmentDetails = data
      .getAll("attachmentDetails")
      .map((value) => String(value).trim());
    const attachmentQuantities = data
      .getAll("attachmentQuantity")
      .map((value) => Number(value));
    const triggerTypes = data
      .getAll("triggerType")
      .map((value) => String(value));
    const triggerLabels = data
      .getAll("triggerLabel")
      .map((value) => String(value).trim());
    const triggerDescriptions = data
      .getAll("triggerDescription")
      .map((value) => String(value).trim());
    const triggerCheckTypes = data
      .getAll("triggerCheckType")
      .map((value) => String(value).trim());
    const triggerDcs = data
      .getAll("triggerDifficultyClass")
      .map((value) => Number(value));
    const triggerPlayerIds = data
      .getAll("triggerPlayerId")
      .map((value) => String(value));

    const attachments = attachmentNames
      .map((name, index) => ({
        type: attachmentTypes[index],
        name,
        details: attachmentDetails[index] ?? "",
        quantity: Number.isFinite(attachmentQuantities[index])
          ? attachmentQuantities[index]
          : undefined,
      }))
      .filter((attachment) => attachment.name);
    const triggers = triggerLabels
      .map((label, index) => ({
        type: triggerTypes[index],
        label,
        description: triggerDescriptions[index] ?? "",
        checkType: triggerCheckTypes[index] || undefined,
        difficultyClass: Number.isFinite(triggerDcs[index])
          ? triggerDcs[index]
          : undefined,
        playerId: triggerPlayerIds[index] || undefined,
        sortOrder: index,
      }))
      .filter((trigger) => trigger.label);

    const occurredAt = String(data.get("occurredAt") ?? "");
    const noteId = String(data.get("noteId") ?? "");
    const sortOrder = Number(data.get("sortOrder"));
    const response = await fetch(
      apiUrl(
        noteId
          ? `/api/campaigns/${route.slug}/notes/${noteId}`
          : `/api/campaigns/${route.slug}/notes`,
      ),
      {
        method: noteId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          locationId: String(data.get("locationId") ?? "") || undefined,
          title: data.get("title"),
          type: data.get("type"),
          summary: data.get("summary"),
          content: data.get("content"),
          dmPrivate: data.get("dmPrivate") === "on",
          occurredAt: occurredAt || undefined,
          keywords: splitList(String(data.get("keywords") ?? "")),
          playerIds: data.getAll("playerIds").map((value) => String(value)),
          attachments,
          triggers,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not save campaign note."),
      );
      return false;
    }

    form.reset();
    await loadCampaign();
    return true;
  }

  async function searchCampaignNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      q: String(data.get("q") ?? ""),
      locationId: String(data.get("locationId") ?? ""),
      playerId: String(data.get("playerId") ?? ""),
      type: String(data.get("type") ?? ""),
    });

    for (const key of Array.from(params.keys())) {
      if (!params.get(key)) params.delete(key);
    }

    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/notes?${params}`),
      {
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Campaign note search failed."));
      return;
    }

    setCampaignNoteResults(await response.json());
  }

  async function moveCampaignNote(noteId: string, direction: "up" | "down") {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/notes/${noteId}/move`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({ direction }),
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not move campaign note."),
      );
      return;
    }

    setCampaignNoteResults([]);
    await loadCampaign();
  }

  async function importKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/import`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
        body: data,
      },
    );

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not import that file."));
      return;
    }

    setStatus("Reference file imported and indexed.");
    form.reset();
    await loadKnowledgeDocuments();
  }

  async function importBundledSrd() {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/import-srd`),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not import the SRD PDF."),
      );
      return;
    }

    setStatus("SRD 5.1 PDF imported and indexed.");
    await loadKnowledgeDocuments();
  }

  async function searchKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      q: String(data.get("q") ?? ""),
      mode: String(data.get("mode") ?? "RulesOnly"),
      sourceType: String(data.get("sourceType") ?? ""),
    });
    if (data.get("wholeWords") === "true") {
      params.set("wholeWords", "true");
    }
    if (!params.get("sourceType")) {
      params.delete("sourceType");
    }
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/search?${params}`),
      {
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (response.ok) {
      setKnowledgeResults(await response.json());
    } else {
      setStatus(await formatApiError(response, "Knowledge search failed."));
    }
  }

  async function askKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/chat`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dmToken}`,
        },
        body: JSON.stringify({
          question: data.get("question"),
          mode: data.get("mode"),
          wholeWords: data.get("wholeWords") === "true",
        }),
      },
    );

    if (response.ok) {
      setKnowledgeChat(await response.json());
    } else {
      setStatus(await formatApiError(response, "DM reference chat failed."));
    }
  }

  async function askPlayerReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/player-reference`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: data.get("category"),
          question: data.get("question"),
          wholeWords: data.get("wholeWords") === "true",
        }),
      },
    );

    if (response.ok) {
      setPlayerReferenceChat(await response.json());
    } else {
      setStatus(await formatApiError(response, "Player reference failed."));
    }
  }

  async function reindexKnowledge(documentId?: string) {
    const path = documentId
      ? `/api/campaigns/${route.slug}/knowledge/documents/${documentId}/reindex`
      : `/api/campaigns/${route.slug}/knowledge/rebuild-index`;
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { Authorization: `Bearer ${dmToken}` },
    });

    if (!response.ok) {
      setStatus(await formatApiError(response, "Could not rebuild the index."));
      return;
    }

    setStatus("Knowledge index rebuilt.");
    await loadKnowledgeDocuments();
  }

  async function deleteKnowledge(documentId: string) {
    const response = await fetch(
      apiUrl(`/api/campaigns/${route.slug}/knowledge/documents/${documentId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${dmToken}` },
      },
    );

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not delete that source."),
      );
      return;
    }

    await loadKnowledgeDocuments();
  }

  async function updateCharacterSheet(
    playerId: string,
    payload: CharacterSheetPayload,
  ) {
    const response = await fetch(apiUrl(`/api/players/${playerId}/sheet`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus(
        await formatApiError(response, "Could not save that character sheet."),
      );
      return;
    }

    setStatus("Character sheet saved.");
    await loadCampaign();
    await loadCharacterSheetHistory(playerId);
  }

  if (!route.slug) {
    return (
      <CampaignCreator
        onSubmit={(event) =>
          trackPending(pendingIds.createCampaign, () => createCampaign(event))
        }
        status={status}
        isPending={isPending}
      />
    );
  }

  if (route.isDm && campaign) {
    return (
      <main
        className={`min-h-screen ${theme.bg} p-2 text-neutral-950 sm:p-3 lg:p-4`}
      >
        <section className="mx-auto grid max-w-[1920px] gap-3">
          <DmCommandBar campaign={campaign} theme={theme} status={status} />
          <DmWorkspace
            isPending={isPending}
            currentCampaignMap={currentCampaignMap}
            currentBgm={currentBgm}
            currentStoryImage={currentStoryImage}
            campaign={campaign}
            theme={theme}
            muted={muted}
            encounterDraft={encounterDraft}
            editingEncounterId={editingEncounterId}
            editingEncounterName={editingEncounterName}
            onCreateEncounter={(event) =>
              trackPending(pendingIds.createEncounter, () =>
                createEncounter(event),
              )
            }
            onEditEncounterDraft={editEncounterDraft}
            onCancelEncounterDraftEdit={cancelEncounterDraftEdit}
            onAddMonsterToEncounterDraft={addMonsterToEncounterDraft}
            onRemoveMonsterFromEncounterDraft={removeMonsterFromEncounterDraft}
            onUpdateEncounterDraftCreature={updateEncounterDraftCreature}
            onAddEncounterDraftCreatureKeyItem={addEncounterDraftCreatureKeyItem}
            onUpdateEncounterDraftCreatureKeyItem={
              updateEncounterDraftCreatureKeyItem
            }
            onRemoveEncounterDraftCreatureKeyItem={
              removeEncounterDraftCreatureKeyItem
            }
            onStartEncounter={(encounterId) =>
              trackPending(pendingIds.startEncounter(encounterId), () =>
                startEncounter(encounterId),
              )
            }
            onBeginEncounterCombat={(encounterId) =>
              trackPending(pendingIds.beginEncounterCombat(encounterId), () =>
                beginEncounterCombat(encounterId),
              )
            }
            onUpdateEncounterCreature={(
              encounterId,
              encounterCreatureId,
              payload,
            ) =>
              trackPending(
                pendingIds.updateEncounterCreature(encounterCreatureId),
                () =>
                  updateEncounterCreature(
                    encounterId,
                    encounterCreatureId,
                    payload,
                  ),
              )
            }
            onSetEncounterStatus={(encounterId, encounterStatus) =>
              trackPending(
                pendingIds.setEncounterStatus(encounterId, encounterStatus),
                () => setEncounterStatus(encounterId, encounterStatus),
              )
            }
            onEndDmTurn={(encounterId) =>
              trackPending(pendingIds.endDmTurn(encounterId), () =>
                endDmTurn(encounterId),
              )
            }
            onResolveEncounter={(encounterId) =>
              trackPending(pendingIds.resolveEncounter(encounterId), () =>
                resolveEncounter(encounterId),
              )
            }
            knowledgeDocuments={knowledgeDocuments}
            knowledgeResults={knowledgeResults}
            knowledgeChat={knowledgeChat}
            campaignNoteResults={campaignNoteResults}
            monsterManualDocuments={monsterManualDocuments}
            monsterCatalogResults={monsterCatalogResults}
            onCreateCampaignLocation={(event) =>
              trackPending(pendingIds.saveLocation, () =>
                createCampaignLocation(event),
              )
            }
            onCreateCampaignNote={(event) =>
              trackPending(pendingIds.saveNote, () => createCampaignNote(event))
            }
            onSearchCampaignNotes={(event) =>
              trackPending(pendingIds.searchNotes, () =>
                searchCampaignNotes(event),
              )
            }
            onMoveCampaignNote={(noteId, direction) =>
              trackPending(pendingIds.moveNote(noteId, direction), () =>
                moveCampaignNote(noteId, direction),
              )
            }
            onUpdateCharacterSheet={(activePlayerId, payload) =>
              trackPending(pendingIds.saveSheet(activePlayerId), () =>
                updateCharacterSheet(activePlayerId, payload),
              )
            }
            onArchivePlayer={(playerId, archived) =>
              trackPending(pendingIds.archivePlayer(playerId), () =>
                archivePlayer(playerId, archived),
              )
            }
            onSetPlayerMapVisible={(visible) =>
              trackPending(pendingIds.togglePlayerMap, () =>
                setPlayerMapVisible(visible),
              )
            }
            onSetPlayerThemePermission={(allowed) =>
              trackPending(pendingIds.togglePlayerTheme, () =>
                setPlayerThemePermission(allowed),
              )
            }
            onUploadStoryImage={(event) =>
              trackPending(pendingIds.uploadStoryImage, () =>
                uploadStoryImage(event),
              )
            }
            onSetStoryImageVisible={(visible) =>
              trackPending(pendingIds.toggleStoryImage, () =>
                setStoryImageVisible(visible),
              )
            }
            onToggleMuted={() => setMuted((value) => !value)}
            onUploadBgm={(event) =>
              trackPending(pendingIds.uploadBgm, () => uploadBgm(event))
            }
            onLinkBgmTrack={(event) =>
              trackPending(pendingIds.linkBgm, () => linkBgmTrack(event))
            }
            onSetBgmTrack={(asset) =>
              trackPending(pendingIds.setBgmTrack(asset.id), () =>
                setBgmTrack(asset),
              )
            }
            onCreateBgmPlaylist={(event) =>
              trackPending(pendingIds.createBgmPlaylist, () =>
                createBgmPlaylist(event),
              )
            }
            onUpdateBgmPlaylist={(playlistId, event) =>
              trackPending(pendingIds.updateBgmPlaylist(playlistId), () =>
                updateBgmPlaylist(playlistId, event),
              )
            }
            onAssignBgmTrack={(assetId, playlistId) =>
              trackPending(pendingIds.assignBgmTrack(assetId), () =>
                assignBgmTrack(assetId, playlistId),
              )
            }
            onMoveBgmTrack={(assetId, direction) =>
              trackPending(pendingIds.moveBgmTrack(assetId, direction), () =>
                moveBgmTrack(assetId, direction),
              )
            }
            onUploadSfx={(event) =>
              trackPending(pendingIds.uploadSfx, () => uploadSfx(event))
            }
            onLinkSfxTrack={(event) =>
              trackPending(pendingIds.linkSfx, () => linkSfxTrack(event))
            }
            onMoveSfxTrack={(assetId, direction) =>
              trackPending(pendingIds.moveSfxTrack(assetId, direction), () =>
                moveSfxTrack(assetId, direction),
              )
            }
            onUploadCampaignMap={(event) =>
              trackPending(pendingIds.uploadCampaignMap, () =>
                uploadCampaignMap(event),
              )
            }
            onImportKnowledge={(event) =>
              trackPending(pendingIds.importKnowledge, () =>
                importKnowledge(event),
              )
            }
            onImportBundledSrd={() =>
              trackPending(pendingIds.importBundledSrd, importBundledSrd)
            }
            onSearchKnowledge={(event) =>
              trackPending(pendingIds.searchKnowledge, () =>
                searchKnowledge(event),
              )
            }
            onAskKnowledge={(event) =>
              trackPending(pendingIds.askKnowledge, () => askKnowledge(event))
            }
            onReindexKnowledge={(documentId) =>
              trackPending(pendingIds.reindexKnowledge(documentId), () =>
                reindexKnowledge(documentId),
              )
            }
            onDeleteKnowledge={(documentId) =>
              trackPending(pendingIds.deleteKnowledge(documentId), () =>
                deleteKnowledge(documentId),
              )
            }
            onImportMonsterManual={(event) =>
              trackPending(pendingIds.importMonsterManual, () =>
                importMonsterManual(event),
              )
            }
            onImportSrdMonsterCatalog={() =>
              trackPending(
                pendingIds.importSrdMonsterCatalog,
                importSrdMonsterCatalog,
              )
            }
            onSearchMonsterCatalog={(event) =>
              trackPending(pendingIds.searchMonsterCatalog, () =>
                searchMonsterCatalog(event),
              )
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen ${theme.bg} p-2 text-neutral-950 sm:p-3 lg:p-4`}
    >
      <section className="mx-auto grid max-w-[1920px] gap-3 lg:grid-cols-[260px_1fr]">
        <aside className={`pixel-panel ${theme.panel} p-4`}>
          <div className="mb-5 flex items-center gap-3">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className={`font-pixel text-sm leading-6 ${theme.primary}`}>
                {campaign?.name ?? route.slug}
              </h1>
              <p className="text-xs font-bold uppercase tracking-wide">
                {route.isDm ? "Campaign Manager" : "Player Camp"}
              </p>
            </div>
          </div>
          <button
            className={`pixel-button mb-4 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-bold ${theme.button}`}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {muted ? "Muted" : "BGM On"}
          </button>
          {currentBgm ? (
            <BgmPlayer
              asset={currentBgm}
              muted={muted}
              startedAt={campaign?.bgmStartedAt}
            />
          ) : null}
          {status ? (
            <p className="mb-4 text-sm font-semibold">{status}</p>
          ) : null}
          {route.isDm && !campaign ? (
            <DmLogin
              onSubmit={(event) =>
                trackPending(pendingIds.loginDm, () => loginDm(event))
              }
              theme={theme}
              isPending={isPending}
            />
          ) : null}
          {!route.isDm && campaign && !currentPlayer ? (
            <PlayerJoin
              onSubmit={(event) =>
                trackPending(pendingIds.joinPlayer, () => createPlayer(event))
              }
              theme={theme}
              isPending={isPending}
            />
          ) : null}
          {!route.isDm && currentPlayer ? (
            <div className="border-2 border-black bg-white/75 p-3 text-sm font-bold text-black">
              Joined as {currentPlayer.name}
            </div>
          ) : null}
        </aside>

        {campaign ? (
          route.isDm ? (
            <DmWorkspace
              isPending={isPending}
              currentCampaignMap={currentCampaignMap}
              currentBgm={currentBgm}
              currentStoryImage={currentStoryImage}
              campaign={campaign}
              theme={theme}
              muted={muted}
              encounterDraft={encounterDraft}
              editingEncounterId={editingEncounterId}
              editingEncounterName={editingEncounterName}
              onCreateEncounter={(event) =>
                trackPending(pendingIds.createEncounter, () =>
                  createEncounter(event),
                )
              }
              onEditEncounterDraft={editEncounterDraft}
              onCancelEncounterDraftEdit={cancelEncounterDraftEdit}
              onAddMonsterToEncounterDraft={addMonsterToEncounterDraft}
              onRemoveMonsterFromEncounterDraft={
                removeMonsterFromEncounterDraft
              }
              onUpdateEncounterDraftCreature={updateEncounterDraftCreature}
              onAddEncounterDraftCreatureKeyItem={
                addEncounterDraftCreatureKeyItem
              }
              onUpdateEncounterDraftCreatureKeyItem={
                updateEncounterDraftCreatureKeyItem
              }
              onRemoveEncounterDraftCreatureKeyItem={
                removeEncounterDraftCreatureKeyItem
              }
              onStartEncounter={(encounterId) =>
                trackPending(pendingIds.startEncounter(encounterId), () =>
                  startEncounter(encounterId),
                )
              }
              onBeginEncounterCombat={(encounterId) =>
                trackPending(pendingIds.beginEncounterCombat(encounterId), () =>
                  beginEncounterCombat(encounterId),
                )
              }
              onUpdateEncounterCreature={(
                encounterId,
                encounterCreatureId,
                payload,
              ) =>
                trackPending(
                  pendingIds.updateEncounterCreature(encounterCreatureId),
                  () =>
                    updateEncounterCreature(
                      encounterId,
                      encounterCreatureId,
                      payload,
                    ),
                )
              }
              onSetEncounterStatus={(encounterId, encounterStatus) =>
                trackPending(
                  pendingIds.setEncounterStatus(encounterId, encounterStatus),
                  () => setEncounterStatus(encounterId, encounterStatus),
                )
              }
              onEndDmTurn={(encounterId) =>
                trackPending(pendingIds.endDmTurn(encounterId), () =>
                  endDmTurn(encounterId),
                )
              }
              onResolveEncounter={(encounterId) =>
                trackPending(pendingIds.resolveEncounter(encounterId), () =>
                  resolveEncounter(encounterId),
                )
              }
              knowledgeDocuments={knowledgeDocuments}
              knowledgeResults={knowledgeResults}
              knowledgeChat={knowledgeChat}
              campaignNoteResults={campaignNoteResults}
              monsterManualDocuments={monsterManualDocuments}
              monsterCatalogResults={monsterCatalogResults}
              onCreateCampaignLocation={(event) =>
                trackPending(pendingIds.saveLocation, () =>
                  createCampaignLocation(event),
                )
              }
              onCreateCampaignNote={(event) =>
                trackPending(pendingIds.saveNote, () =>
                  createCampaignNote(event),
                )
              }
              onSearchCampaignNotes={(event) =>
                trackPending(pendingIds.searchNotes, () =>
                  searchCampaignNotes(event),
                )
              }
              onMoveCampaignNote={(noteId, direction) =>
                trackPending(pendingIds.moveNote(noteId, direction), () =>
                  moveCampaignNote(noteId, direction),
                )
              }
              onUpdateCharacterSheet={(activePlayerId, payload) =>
                trackPending(pendingIds.saveSheet(activePlayerId), () =>
                  updateCharacterSheet(activePlayerId, payload),
                )
              }
              onArchivePlayer={(playerId, archived) =>
                trackPending(pendingIds.archivePlayer(playerId), () =>
                  archivePlayer(playerId, archived),
                )
              }
              onSetPlayerMapVisible={(visible) =>
                trackPending(pendingIds.togglePlayerMap, () =>
                  setPlayerMapVisible(visible),
                )
              }
              onSetPlayerThemePermission={(allowed) =>
                trackPending(pendingIds.togglePlayerTheme, () =>
                  setPlayerThemePermission(allowed),
                )
              }
              onUploadStoryImage={(event) =>
                trackPending(pendingIds.uploadStoryImage, () =>
                  uploadStoryImage(event),
                )
              }
              onSetStoryImageVisible={(visible) =>
                trackPending(pendingIds.toggleStoryImage, () =>
                  setStoryImageVisible(visible),
                )
              }
              onToggleMuted={() => setMuted((value) => !value)}
              onUploadBgm={(event) =>
                trackPending(pendingIds.uploadBgm, () => uploadBgm(event))
              }
              onLinkBgmTrack={(event) =>
                trackPending(pendingIds.linkBgm, () => linkBgmTrack(event))
              }
              onSetBgmTrack={(asset) =>
                trackPending(pendingIds.setBgmTrack(asset.id), () =>
                  setBgmTrack(asset),
                )
              }
              onCreateBgmPlaylist={(event) =>
                trackPending(pendingIds.createBgmPlaylist, () =>
                  createBgmPlaylist(event),
                )
              }
              onUpdateBgmPlaylist={(playlistId, event) =>
                trackPending(pendingIds.updateBgmPlaylist(playlistId), () =>
                  updateBgmPlaylist(playlistId, event),
                )
              }
              onAssignBgmTrack={(assetId, playlistId) =>
                trackPending(pendingIds.assignBgmTrack(assetId), () =>
                  assignBgmTrack(assetId, playlistId),
                )
              }
              onMoveBgmTrack={(assetId, direction) =>
                trackPending(pendingIds.moveBgmTrack(assetId, direction), () =>
                  moveBgmTrack(assetId, direction),
                )
              }
              onUploadSfx={(event) =>
                trackPending(pendingIds.uploadSfx, () => uploadSfx(event))
              }
              onLinkSfxTrack={(event) =>
                trackPending(pendingIds.linkSfx, () => linkSfxTrack(event))
              }
              onMoveSfxTrack={(assetId, direction) =>
                trackPending(pendingIds.moveSfxTrack(assetId, direction), () =>
                  moveSfxTrack(assetId, direction),
                )
              }
              onUploadCampaignMap={(event) =>
                trackPending(pendingIds.uploadCampaignMap, () =>
                  uploadCampaignMap(event),
                )
              }
              onImportKnowledge={(event) =>
                trackPending(pendingIds.importKnowledge, () =>
                  importKnowledge(event),
                )
              }
              onImportBundledSrd={() =>
                trackPending(pendingIds.importBundledSrd, importBundledSrd)
              }
              onSearchKnowledge={(event) =>
                trackPending(pendingIds.searchKnowledge, () =>
                  searchKnowledge(event),
                )
              }
              onAskKnowledge={(event) =>
                trackPending(pendingIds.askKnowledge, () => askKnowledge(event))
              }
              onReindexKnowledge={(documentId) =>
                trackPending(pendingIds.reindexKnowledge(documentId), () =>
                  reindexKnowledge(documentId),
                )
              }
              onDeleteKnowledge={(documentId) =>
                trackPending(pendingIds.deleteKnowledge(documentId), () =>
                  deleteKnowledge(documentId),
                )
              }
              onImportMonsterManual={(event) =>
                trackPending(pendingIds.importMonsterManual, () =>
                  importMonsterManual(event),
                )
              }
              onImportSrdMonsterCatalog={() =>
                trackPending(
                  pendingIds.importSrdMonsterCatalog,
                  importSrdMonsterCatalog,
                )
              }
              onSearchMonsterCatalog={(event) =>
                trackPending(pendingIds.searchMonsterCatalog, () =>
                  searchMonsterCatalog(event),
                )
              }
            />
          ) : currentPlayer ? (
            <PlayerWorkspace
              isPending={isPending}
              campaign={campaign}
              player={currentPlayer}
              currentCampaignMap={currentCampaignMap}
              currentStoryImage={currentStoryImage}
              theme={theme}
              playerReferenceChat={playerReferenceChat}
              characterSheetHistory={characterSheetHistory}
              onAskPlayerReference={(event) =>
                trackPending(pendingIds.askPlayerReference, () =>
                  askPlayerReference(event),
                )
              }
              onSubmitInitiative={(encounterId, activePlayerId, roll) =>
                trackPending(
                  pendingIds.submitInitiative(encounterId, activePlayerId),
                  () => submitInitiative(encounterId, activePlayerId, roll),
                )
              }
              onEndPlayerTurn={(encounterId, activePlayerId) =>
                trackPending(
                  pendingIds.endPlayerTurn(encounterId, activePlayerId),
                  () => endPlayerTurn(encounterId, activePlayerId),
                )
              }
              onUpdateCharacterSheet={(activePlayerId, payload) =>
                trackPending(pendingIds.saveSheet(activePlayerId), () =>
                  updateCharacterSheet(activePlayerId, payload),
                )
              }
              onUpdatePlayerTheme={(themeKey) =>
                trackPending(pendingIds.updateOwnTheme, () =>
                  updatePlayerTheme(themeKey),
                )
              }
            />
          ) : (
            <PlayerWelcome theme={theme} />
          )
        ) : null}
      </section>
    </main>
  );
}

async function formatApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message;
    return message || fallback;
  } catch {
    return fallback;
  }
}

function publicAssetUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}

createRoot(document.getElementById("root")!).render(<App />);
