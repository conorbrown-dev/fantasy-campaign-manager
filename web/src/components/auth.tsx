import type { FormEvent } from "react";
import { UserPlus } from "lucide-react";
import type { PendingLookup } from "../domain";
import { pendingIds } from "../domain";
import { BusyButtonContent, Field } from "./common";

export function CampaignCreator({
  onSubmit,
  status,
  isPending,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: string;
  isPending: PendingLookup;
}) {
  const loading = isPending(pendingIds.createCampaign);
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
        <button
          className="pixel-button flex items-center justify-center gap-2 bg-[#7a45b8] px-4 py-3 font-bold text-white"
          disabled={loading}
        >
          <BusyButtonContent loading={loading} loadingLabel="Raising...">
            Raise the Banner
          </BusyButtonContent>
        </button>
      </form>
    </main>
  );
}

export function DmLogin({
  onSubmit,
  theme,
  isPending,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  theme: { button: string };
  isPending: PendingLookup;
}) {
  const loading = isPending(pendingIds.loginDm);
  return (
    <form onSubmit={onSubmit}>
      <Field label="DM password" name="password" type="password" />
      <button
        className={`pixel-button w-full px-3 py-2 font-bold ${theme.button}`}
        disabled={loading}
      >
        <BusyButtonContent loading={loading} loadingLabel="Unlocking...">
          Unlock
        </BusyButtonContent>
      </button>
    </form>
  );
}

export function PlayerJoin({
  onSubmit,
  theme,
  isPending,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  theme: { button: string };
  isPending: PendingLookup;
}) {
  const loading = isPending(pendingIds.joinPlayer);
  return (
    <form onSubmit={onSubmit}>
      <Field label="Player name" name="name" />
      <Field
        label="Player access code"
        name="accessCode"
        type="password"
        minLength={4}
      />
      <button
        className={`pixel-button flex w-full items-center justify-center gap-2 px-3 py-2 font-bold ${theme.button}`}
        disabled={loading}
      >
        <BusyButtonContent
          loading={loading}
          loadingLabel="Joining..."
          icon={<UserPlus className="h-4 w-4" />}
        >
          Join
        </BusyButtonContent>
      </button>
    </form>
  );
}
