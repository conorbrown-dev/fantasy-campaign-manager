import React, { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  BookOpen,
  Coins,
  Map,
  Music,
  Save,
  Search,
  Shield,
  Skull,
  Swords,
  Upload,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { apiUrl, socketOrigin } from "./api";
import "./main.css";

type ThemeKey = "PURPLE_LILAC" | "MINT_YELLOW" | "PINK_GRAY" | "DM_FORGE";

type Player = {
  id: string;
  name: string;
  iconUrl?: string;
  stats: Record<string, string | number>;
  equipment: { items?: string[] };
  money: Record<string, number>;
  rolls?: unknown[];
  abilities: string[];
};

type Creature = {
  id: string;
  name: string;
  imageUrl?: string;
  preferredEnvironment: string;
  hitPoints?: number;
  armorClass?: number;
};

type Asset = {
  id: string;
  kind: string;
  name: string;
  url: string;
  mimeType: string;
  createdAt?: string;
};

type Campaign = {
  id: string;
  name: string;
  slug: string;
  theme: ThemeKey;
  currentBgmAssetId?: string | null;
  bgmStartedAt?: string | null;
  assets?: Asset[];
  players: Player[];
  quests: Array<{ id: string; title: string; summary: string; status: string }>;
  mapPins: Array<{
    id: string;
    label: string;
    iconUrl?: string;
    x: number;
    y: number;
  }>;
};

const themeClasses: Record<
  ThemeKey,
  {
    bg: string;
    panel: string;
    primary: string;
    secondary: string;
    button: string;
  }
> = {
  PURPLE_LILAC: {
    bg: "bg-[#2a1748]",
    panel: "bg-[#f1e7ff]",
    primary: "text-[#3d2368]",
    secondary: "bg-[#d9b8ff]",
    button: "bg-[#7a45b8] text-white",
  },
  MINT_YELLOW: {
    bg: "bg-[#1f4b42]",
    panel: "bg-[#efffd6]",
    primary: "text-[#163f38]",
    secondary: "bg-[#bff3df]",
    button: "bg-[#348f76] text-white",
  },
  PINK_GRAY: {
    bg: "bg-[#4c3845]",
    panel: "bg-[#fff0f6]",
    primary: "text-[#503444]",
    secondary: "bg-[#d8d8dc]",
    button: "bg-[#d95f9f] text-white",
  },
  DM_FORGE: {
    bg: "bg-metal",
    panel: "bg-stone text-white",
    primary: "text-white",
    secondary: "bg-[#4d4d4d]",
    button: "bg-wood text-white",
  },
};

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
  const [muted, setMuted] = useState(false);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [status, setStatus] = useState("");

  const theme =
    themeClasses[campaign?.theme ?? (route.isDm ? "DM_FORGE" : "PURPLE_LILAC")];
  const currentBgm = campaign?.assets?.find(
    (asset) => asset.id === campaign.currentBgmAssetId,
  );

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

  React.useEffect(() => {
    void loadCampaign();
  }, [dmToken]);

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
    const data = new FormData(event.currentTarget);
    await fetch(apiUrl(`/api/campaigns/${route.slug}/players`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name") }),
    });
    event.currentTarget.reset();
    await loadCampaign();
  }

  async function createEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await fetch(apiUrl(`/api/campaigns/${route.slug}/encounters`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dmToken}`,
      },
      body: JSON.stringify({ name: data.get("name"), creatureIds: [] }),
    });
    event.currentTarget.reset();
    await loadCampaign();
  }

  async function searchCreatures(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      q: String(data.get("q") ?? ""),
      environment: String(data.get("environment") ?? ""),
    });
    const response = await fetch(apiUrl(`/api/creatures?${params}`));
    setCreatures(await response.json());
  }

  async function uploadBgm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
        await formatApiError(upload, "Could not upload that BGM track."),
      );
      return;
    }

    const asset: Asset = await upload.json();
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

    const startedAt = new Date().toISOString();
    socket.emit("bgm:sync", {
      slug: route.slug,
      asset,
      assetUrl: apiUrl(asset.url),
      startedAt,
    });
    event.currentTarget.reset();
    await loadCampaign();
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
  }

  if (!route.slug) {
    return <CampaignCreator onSubmit={createCampaign} status={status} />;
  }

  return (
    <main
      className={`min-h-screen ${theme.bg} p-4 text-neutral-950 sm:p-6 lg:p-8`}
    >
      <section className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
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
            <DmLogin onSubmit={loginDm} theme={theme} />
          ) : null}
          {!route.isDm && campaign ? (
            <PlayerJoin onSubmit={createPlayer} theme={theme} />
          ) : null}
        </aside>

        {campaign ? (
          route.isDm ? (
            <DmWorkspace
              campaign={campaign}
              theme={theme}
              creatures={creatures}
              onCreateEncounter={createEncounter}
              onSearchCreatures={searchCreatures}
              onUploadBgm={uploadBgm}
            />
          ) : (
            <PlayerWorkspace
              campaign={campaign}
              theme={theme}
              onUpdateCharacterSheet={updateCharacterSheet}
            />
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

function CampaignCreator({
  onSubmit,
  status,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: string;
}) {
  return (
    <main className="min-h-screen bg-[#2a1748] p-6 text-neutral-950">
      <form
        onSubmit={onSubmit}
        className="pixel-panel mx-auto mt-10 max-w-xl bg-[#f1e7ff] p-5"
      >
        <h1 className="mb-5 font-pixel text-lg leading-8 text-[#3d2368]">
          New Campaign
        </h1>
        <Field label="Campaign name" name="name" />
        <Field
          label="DM password"
          name="password"
          type="password"
          minLength={6}
        />
        <label className="mb-4 block text-sm font-bold">
          Theme
          <select
            name="theme"
            className="mt-2 w-full border-2 border-black bg-white p-3"
          >
            <option value="PURPLE_LILAC">Purple and lilac</option>
            <option value="MINT_YELLOW">Mint green and pastel yellow</option>
            <option value="PINK_GRAY">Light pink and gray</option>
            <option value="DM_FORGE">DM forge</option>
          </select>
        </label>
        {status ? (
          <p className="mb-4 border-2 border-black bg-white p-3 text-sm font-bold text-[#7a1f45]">
            {status}
          </p>
        ) : null}
        <button className="pixel-button bg-[#7a45b8] px-4 py-3 font-bold text-white">
          Raise the Banner
        </button>
      </form>
    </main>
  );
}

function DmLogin({
  onSubmit,
  theme,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  theme: { button: string };
}) {
  return (
    <form onSubmit={onSubmit}>
      <Field label="DM password" name="password" type="password" />
      <button
        className={`pixel-button w-full px-3 py-2 font-bold ${theme.button}`}
      >
        Unlock
      </button>
    </form>
  );
}

function PlayerJoin({
  onSubmit,
  theme,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  theme: { button: string };
}) {
  return (
    <form onSubmit={onSubmit}>
      <Field label="New player" name="name" />
      <button
        className={`pixel-button flex w-full items-center justify-center gap-2 px-3 py-2 font-bold ${theme.button}`}
      >
        <UserPlus className="h-4 w-4" />
        Join
      </button>
    </form>
  );
}

type CharacterSheetPayload = {
  stats: Record<string, string | number>;
  equipment: { items: string[] };
  money: Record<string, number>;
  rolls: unknown[];
  abilities: string[];
};

function PlayerWorkspace({
  campaign,
  theme,
  onUpdateCharacterSheet,
}: {
  campaign: Campaign;
  theme: Record<string, string>;
  onUpdateCharacterSheet: (
    playerId: string,
    payload: CharacterSheetPayload,
  ) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <section className={`pixel-panel ${theme.panel} p-4`}>
        <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
          <Map className="h-5 w-5" />
          Map
        </h2>
        <MapBoard campaign={campaign} />
      </section>
      <section className={`pixel-panel ${theme.panel} p-4`}>
        <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
          <Coins className="h-5 w-5" />
          Party Sheets
        </h2>
        <div className="grid gap-3">
          {campaign.players.map((player) => (
            <CharacterSheet
              key={player.id}
              player={player}
              onSave={onUpdateCharacterSheet}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DmWorkspace({
  campaign,
  theme,
  creatures,
  onCreateEncounter,
  onSearchCreatures,
  onUploadBgm,
}: {
  campaign: Campaign;
  theme: Record<string, string>;
  creatures: Creature[];
  onCreateEncounter: (event: FormEvent<HTMLFormElement>) => void;
  onSearchCreatures: (event: FormEvent<HTMLFormElement>) => void;
  onUploadBgm: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <section className={`pixel-panel ${theme.panel} p-4`}>
        <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
          <Map className="h-5 w-5" />
          Battle Map
        </h2>
        <MapBoard campaign={campaign} />
      </section>
      <section className={`pixel-panel ${theme.panel} p-4`}>
        <h2 className="mb-4 flex items-center gap-2 font-pixel text-sm leading-6">
          <Swords className="h-5 w-5" />
          Encounters
        </h2>
        <form
          onSubmit={onUploadBgm}
          className="mb-5 border-2 border-black bg-white/80 p-3 text-black"
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Music className="h-4 w-4" />
            BGM
          </h3>
          <input type="hidden" name="kind" value="BGM" />
          <input
            name="file"
            type="file"
            accept="audio/*"
            className="mb-3 w-full border-2 border-black bg-white p-2 text-sm"
            required
          />
          <button
            className={`pixel-button flex w-full items-center justify-center gap-2 px-3 py-2 font-bold ${theme.button}`}
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </form>
        <form onSubmit={onCreateEncounter} className="mb-5">
          <Field label="Encounter name" name="name" />
          <button
            className={`pixel-button w-full px-3 py-2 font-bold ${theme.button}`}
          >
            Prepare
          </button>
        </form>
        <form onSubmit={onSearchCreatures} className="mb-4 grid gap-2">
          <Field label="Creature" name="q" />
          <Field label="Environment" name="environment" />
          <button
            className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 font-bold ${theme.button}`}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>
        <div className="grid gap-2">
          {creatures.map((creature) => (
            <div
              key={creature.id}
              className="border-2 border-black bg-white/80 p-3 text-black"
            >
              <div className="flex items-center gap-3">
                {creature.imageUrl ? (
                  <img
                    src={creature.imageUrl}
                    alt=""
                    className="h-12 w-12 border-2 border-black object-cover"
                  />
                ) : (
                  <Skull className="h-10 w-10" />
                )}
                <div>
                  <p className="font-bold">{creature.name}</p>
                  <p className="text-xs uppercase">
                    {creature.preferredEnvironment}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BgmPlayer({
  asset,
  muted,
  startedAt,
}: {
  asset: Asset;
  muted: boolean;
  startedAt?: string | null;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !startedAt || !audio.duration || Number.isNaN(audio.duration))
      return;

    const elapsedSeconds = Math.max(
      0,
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    );
    audio.currentTime = elapsedSeconds % audio.duration;
  }, [asset.id, startedAt]);

  return (
    <div className="mb-4 border-2 border-black bg-white/70 p-2 text-black">
      <p className="mb-2 truncate text-xs font-black">{asset.name}</p>
      <audio
        ref={audioRef}
        src={apiUrl(asset.url)}
        muted={muted}
        loop
        controls
        autoPlay
        className="h-8 w-full"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (
            !audio ||
            !startedAt ||
            !audio.duration ||
            Number.isNaN(audio.duration)
          )
            return;
          const elapsedSeconds = Math.max(
            0,
            (Date.now() - new Date(startedAt).getTime()) / 1000,
          );
          audio.currentTime = elapsedSeconds % audio.duration;
        }}
      />
    </div>
  );
}

function MapBoard({ campaign }: { campaign: Campaign }) {
  return (
    <div className="relative aspect-[16/10] min-h-[320px] overflow-hidden border-4 border-black bg-[linear-gradient(45deg,#7aa66a_25%,#517a55_25%,#517a55_50%,#7aa66a_50%,#7aa66a_75%,#517a55_75%)] bg-[length:32px_32px]">
      {campaign.mapPins.map((pin) => (
        <div
          key={pin.id}
          className="absolute grid h-12 w-12 place-items-center border-2 border-black bg-white text-xs font-bold shadow-pixel"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          title={pin.label}
        >
          {pin.iconUrl ? (
            <img
              src={pin.iconUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            pin.label.slice(0, 2)
          )}
        </div>
      ))}
    </div>
  );
}

function CharacterSheet({
  player,
  onSave,
}: {
  player: Player;
  onSave: (playerId: string, payload: CharacterSheetPayload) => Promise<void>;
}) {
  const stats = player.stats ?? {};
  const money = player.money ?? {};

  async function submitSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await onSave(player.id, {
      stats: {
        level: numberFromForm(data, "level", 1),
        className: String(data.get("className") ?? ""),
        species: String(data.get("species") ?? ""),
        strength: numberFromForm(data, "strength", 10),
        dexterity: numberFromForm(data, "dexterity", 10),
        constitution: numberFromForm(data, "constitution", 10),
        intelligence: numberFromForm(data, "intelligence", 10),
        wisdom: numberFromForm(data, "wisdom", 10),
        charisma: numberFromForm(data, "charisma", 10),
      },
      equipment: {
        items: splitList(String(data.get("items") ?? "")),
      },
      money: {
        copper: numberFromForm(data, "copper", 0),
        silver: numberFromForm(data, "silver", 0),
        electrum: numberFromForm(data, "electrum", 0),
        gold: numberFromForm(data, "gold", 0),
        platinum: numberFromForm(data, "platinum", 0),
      },
      rolls: player.rolls ?? [],
      abilities: splitList(String(data.get("abilities") ?? "")),
    });
  }

  return (
    <form
      onSubmit={submitSheet}
      className="border-2 border-black bg-white/85 p-3 text-black shadow-pixel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <BookOpen className="h-4 w-4" />
          {player.name}
        </h3>
        <button className="pixel-button flex items-center justify-center gap-2 bg-[#348f76] px-3 py-2 text-sm font-bold text-white">
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>
      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <SheetField
          label="Level"
          name="level"
          type="number"
          defaultValue={stats.level ?? 1}
          min={1}
        />
        <SheetField
          label="Class"
          name="className"
          defaultValue={stats.className ?? ""}
        />
        <SheetField
          label="Species"
          name="species"
          defaultValue={stats.species ?? ""}
        />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {[
          "strength",
          "dexterity",
          "constitution",
          "intelligence",
          "wisdom",
          "charisma",
        ].map((stat) => (
          <SheetField
            key={stat}
            label={stat.slice(0, 3).toUpperCase()}
            name={stat}
            type="number"
            defaultValue={stats[stat] ?? 10}
          />
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <SheetField
          label="Equipment"
          name="items"
          defaultValue={(player.equipment?.items ?? []).join(", ")}
        />
        <SheetField
          label="Abilities"
          name="abilities"
          defaultValue={(player.abilities ?? []).join(", ")}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {["copper", "silver", "electrum", "gold", "platinum"].map((coin) => (
          <SheetField
            key={coin}
            label={coin.slice(0, 2).toUpperCase()}
            name={coin}
            type="number"
            defaultValue={money[coin] ?? 0}
            min={0}
          />
        ))}
      </div>
    </form>
  );
}

function numberFromForm(data: FormData, name: string, fallback: number) {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SheetField({
  label,
  name,
  defaultValue,
  type = "text",
  min,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  type?: string;
  min?: number;
}) {
  return (
    <label className="block text-xs font-black uppercase">
      {label}
      <input
        name={name}
        type={type}
        min={min}
        defaultValue={defaultValue}
        className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
        required
      />
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  minLength?: number;
}) {
  return (
    <label className="mb-4 block text-sm font-bold">
      {label}
      <input
        name={name}
        type={type}
        minLength={minLength}
        className="mt-2 w-full border-2 border-black bg-white p-3 text-black"
        required
      />
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
