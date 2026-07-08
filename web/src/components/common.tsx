import React from "react";
import { Loader2 } from "lucide-react";
import type { CampaignLocation, Player } from "../domain";
import { booleanValue, numberValue, recordValue } from "../domain";

export type TabOption<T extends string> = {
  id: T;
  label: string;
};

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  theme,
}: {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  theme: Record<string, string>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-2 border-black bg-white/70 p-2 text-black">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`pixel-button shrink-0 px-3 py-2 text-xs font-black ${activeTab === tab.id ? theme.button : "bg-white text-black"
            }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PersistentTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [hasBeenActive, setHasBeenActive] = React.useState(active);

  React.useEffect(() => {
    if (active) {
      setHasBeenActive(true);
    }
  }, [active]);

  if (!hasBeenActive) return null;

  return <div hidden={!active}>{children}</div>;
}

export function BusyButtonContent({
  loading,
  icon,
  children,
  loadingLabel,
}: {
  loading: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  loadingLabel?: React.ReactNode;
}) {
  return (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {loading ? (loadingLabel ?? children) : children}
    </>
  );
}

export function ToggleButtonField({
  name,
  label,
  title,
  compact = false,
}: {
  name: string;
  label: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <label
      className={`${compact ? "mt-0 lg:mt-6" : ""} inline-flex cursor-pointer items-center`}
      title={title}
    >
      <input
        name={name}
        type="checkbox"
        value="true"
        className="peer sr-only"
      />
      <span className="pixel-button flex min-h-10 items-center justify-center border-2 border-black bg-white px-3 py-2 text-xs font-black text-black peer-checked:bg-[#ffd966]">
        {label}
      </span>
    </label>
  );
}

export function CampaignLocationSelect({
  locations,
  name,
  label,
  includeAny = false,
  defaultValue = "",
}: {
  locations: CampaignLocation[];
  name: string;
  label: string;
  includeAny?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="mb-0 block text-sm font-bold">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
      >
        {includeAny ? <option value="">Any</option> : null}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CampaignPlayerSelect({
  players,
  name,
  label,
  includeAny = false,
  defaultValue = "",
  includeArchived = false,
}: {
  players: Player[];
  name: string;
  label: string;
  includeAny?: boolean;
  defaultValue?: string;
  includeArchived?: boolean;
}) {
  const selectablePlayers = includeArchived
    ? players
    : players.filter((player) => !player.archivedAt);

  return (
    <label className="mb-0 block text-sm font-bold">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
      >
        {includeAny ? <option value="">Any</option> : null}
        {selectablePlayers.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SheetChecklist({
  title,
  fields,
  values,
  namePrefix,
}: {
  title: string;
  fields: Array<{ id: string; label: string }>;
  values: Record<string, unknown>;
  namePrefix: string;
}) {
  return (
    <div className="border-2 border-black bg-[#f8f4e8] p-2">
      <p className="mb-2 text-xs font-black uppercase">{title}</p>
      <div className="grid gap-1">
        {fields.map((field) => {
          const value = recordValue(values[field.id]);
          return (
            <div
              key={field.id}
              className="grid grid-cols-[24px_1fr_70px] items-center gap-2 text-xs font-bold"
            >
              <input
                type="checkbox"
                name={`${namePrefix}-${field.id}-proficient`}
                defaultChecked={booleanValue(value.proficient)}
                title={`${field.label} proficient`}
              />
              <span>{field.label}</span>
              <input
                type="number"
                name={`${namePrefix}-${field.id}-bonus`}
                defaultValue={numberValue(value.bonus, 0)}
                className="w-full border-2 border-black bg-white p-1 text-sm text-black"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SheetField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  type = "text",
  min,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  value?: string | number;
  onChange?: (value: string) => void;
  type?: string;
  min?: number;
  required?: boolean;
}) {
  const controlledProps =
    value === undefined
      ? { defaultValue }
      : {
          value,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onChange?.(event.currentTarget.value),
        };

  return (
    <label className="block text-xs font-black uppercase">
      {label}
      <input
        name={name}
        type={type}
        min={min}
        {...controlledProps}
        className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
        required={required}
      />
    </label>
  );
}

export function Field({
  label,
  name,
  type = "text",
  minLength,
  min,
  placeholder,
  required = true,
  compact = false,
  defaultValue = "",
}: {
  label: string;
  name: string;
  type?: string;
  minLength?: number;
  min?: number;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <label className={`${compact ? "mb-0" : "mb-4"} block text-sm font-bold`}>
      {label}
      <input
        name={name}
        type={type}
        minLength={minLength}
        min={min}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`${compact ? "mt-1 p-2 text-sm" : "mt-2 p-3"} w-full border-2 border-black bg-white text-black`}
        required={required}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  rows = 4,
  required = true,
  compact = false,
  defaultValue = "",
}: {
  label: string;
  name: string;
  rows?: number;
  required?: boolean;
  compact?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className={`${compact ? "mb-0" : "mb-4"} block text-sm font-bold`}>
      {label}
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className={`${compact ? "mt-1 p-2 text-sm" : "mt-2 p-3"} w-full resize-y border-2 border-black bg-white text-black`}
        required={required}
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  name,
  options,
  defaultValue,
  compact = false,
  optionLabel = (value) => value,
}: {
  label: string;
  name: string;
  options: T[];
  defaultValue?: T;
  compact?: boolean;
  optionLabel?: (value: T) => string;
}) {
  return (
    <label className={`${compact ? "mb-0" : "mb-4"} block text-sm font-bold`}>
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className={`${compact ? "mt-1 p-2 text-sm" : "mt-2 p-3"} w-full border-2 border-black bg-white text-black`}
      >
        {options.map((option) => (
          <option key={option || "any"} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
