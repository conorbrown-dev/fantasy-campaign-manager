import React from "react";
import { ExternalLink } from "lucide-react";
import { apiUrl } from "../api";
import type { Asset } from "../domain";

export function BgmPlayer({
  asset,
  muted,
  startedAt,
}: {
  asset: Asset;
  muted: boolean;
  startedAt?: string | null;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const external = externalTrackInfo(asset.url);

  const syncPlaybackPosition = React.useCallback(
    (audio: HTMLAudioElement) => {
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
    },
    [startedAt],
  );

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    syncPlaybackPosition(audio);
  }, [asset.id, startedAt, syncPlaybackPosition]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      const elapsedSeconds = Math.max(
        0,
        (Date.now() - new Date(startedAt ?? "").getTime()) / 1000,
      );
      const expectedTime = elapsedSeconds % audio.duration;
      if (
        !audio.duration ||
        Number.isNaN(audio.duration) ||
        Number.isNaN(expectedTime)
      )
        return;

      if (Math.abs(audio.currentTime - expectedTime) > 1.5) {
        audio.currentTime = expectedTime;
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [asset.id, startedAt]);

  if (external) {
    return (
      <div className="border-2 border-black bg-white/70 p-2 text-black">
        <p className="mb-1 truncate text-[11px] font-black">{asset.name}</p>
        <ExternalTrackControls asset={asset} compact={false} />
      </div>
    );
  }

  return (
    <div className="border-2 border-black bg-white/70 p-2 text-black">
      <p className="mb-1 truncate text-[11px] font-black">{asset.name}</p>
      <audio
        ref={audioRef}
        src={publicAssetUrl(asset.url)}
        muted={muted}
        loop
        controls
        autoPlay
        className="h-8 w-full"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;

          syncPlaybackPosition(audio);
        }}
        onPlay={() => {
          const audio = audioRef.current;
          if (!audio) return;

          syncPlaybackPosition(audio);
        }}
      />
    </div>
  );
}

export function BgmTrackControls({ asset }: { asset: Asset }) {
  const external = externalTrackInfo(asset.url);

  if (external) {
    return <ExternalTrackControls asset={asset} compact />;
  }

  return (
    <audio
      src={publicAssetUrl(asset.url)}
      controls
      className="h-8 w-full"
      preload="metadata"
    />
  );
}

function ExternalTrackControls({
  asset,
  compact,
}: {
  asset: Asset;
  compact: boolean;
}) {
  const external = externalTrackInfo(asset.url);
  if (!external) return null;

  if (external.embedUrl) {
    return (
      <iframe
        title={asset.name}
        src={external.embedUrl}
        className={
          compact
            ? "h-20 w-full border-2 border-black"
            : "h-32 w-full border-2 border-black"
        }
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }

  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className="pixel-button flex items-center justify-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-black text-black"
    >
      <ExternalLink className="h-4 w-4" />
      Open Track
    </a>
  );
}

export function MapBoard({
  currentCampaignMap,
}: {
  currentCampaignMap: Asset;
}) {
  return (
    <div>
      <img src={apiUrl(currentCampaignMap.url)} />
    </div>
  );
}

function publicAssetUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}

function externalTrackInfo(url: string) {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return {
        provider: "YouTube",
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : "",
      };
    }

    if (
      hostname === "youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      const videoId = parsed.searchParams.get("v");
      return {
        provider: "YouTube",
        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : "",
      };
    }

    if (hostname === "open.spotify.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const [type, id] = parts;
      const supported = new Set([
        "album",
        "artist",
        "episode",
        "playlist",
        "show",
        "track",
      ]);
      return {
        provider: "Spotify",
        embedUrl:
          type && id && supported.has(type)
            ? `https://open.spotify.com/embed/${type}/${id}`
            : "",
      };
    }

    return { provider: hostname, embedUrl: "" };
  } catch {
    return null;
  }
}
