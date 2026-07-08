import { Skull } from "lucide-react";
import { apiUrl } from "../api";
import type { Creature, Encounter } from "../domain";
import { abilityModifier, signedModifier } from "../domain";

export function TurnInstructionCard({
  audience,
}: {
  audience: "player" | "dm";
}) {
  const instructions =
    audience === "player"
      ? [
          "Choose movement, an action, and an optional bonus action.",
          "Examples: attack, cast a spell, dodge, dash, disengage, help, hide, ready, search, or use an object.",
          "Tell the DM what you are doing, roll when asked, then end your turn.",
        ]
      : [
          "Run the monsters and describe what the party can perceive.",
          "Examples: move a monster, attack, cast a spell, use an ability, call for saves, apply damage, or reveal consequences.",
          "Advance the turn once the monsters have acted.",
        ];

  return (
    <div className="mt-3 border-2 border-black bg-[#f8f4e8] p-3 text-sm text-black">
      <p className="mb-2 font-black">
        {audience === "player" ? "Turn options" : "DM turn options"}
      </p>
      <ul className="grid gap-1 pl-4 font-semibold">
        {instructions.map((instruction) => (
          <li key={instruction} className="list-disc">
            {instruction}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EncounterTurnSummary({ encounter }: { encounter: Encounter }) {
  const turnOrder = encounter.ruleNotes?.turnOrder ?? [];
  const current = getCurrentTurnActor(encounter);

  if ((encounter.ruleNotes?.phase ?? "DRAFT") === "ROLLING") {
    return (
      <p className="border-2 border-black bg-white p-3 text-sm font-black text-black">
        Waiting for initiative rolls.
      </p>
    );
  }

  return (
    <div className="border-2 border-black bg-white p-3 text-black">
      <p className="font-black">
        Current turn: {current ? current.name : "No turn selected"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {turnOrder.map((actor, index) => (
          <span
            key={`${actor.type}-${actor.id}`}
            className={`border-2 border-black px-2 py-1 text-xs font-black ${
              index === (encounter.ruleNotes?.currentTurnIndex ?? 0)
                ? "bg-[#bff3df]"
                : "bg-white"
            }`}
          >
            {actor.name} {actor.type === "PLAYER" ? `(${actor.roll})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CreatureStatCard({
  creature,
  encounterCreature,
  showKeyItems = false,
}: {
  creature: Creature;
  encounterCreature?: Encounter["creatures"][number];
  showKeyItems?: boolean;
}) {
  const armorClass = encounterCreature?.armorClass ?? creature.armorClass;
  const hitPoints = encounterCreature?.maxHitPoints ?? creature.hitPoints;
  const currentHp = encounterCreature?.currentHp;
  const speed = encounterCreature?.speed;
  const initiative = encounterCreature?.initiative;
  const abilityStats = [
    ["Strength", encounterCreature?.strength],
    ["Dexterity", encounterCreature?.dexterity],
    ["Constitution", encounterCreature?.constitution],
    ["Intelligence", encounterCreature?.intelligence],
    ["Wisdom", encounterCreature?.wisdom],
    ["Charisma", encounterCreature?.charisma],
  ];

  return (
    <article className="grid gap-3 border-2 border-black bg-white p-3 text-sm text-black lg:grid-cols-[minmax(240px,360px)_1fr]">
      {creature.imageUrl ? (
        <a
          href={apiUrl(creature.imageUrl)}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={apiUrl(creature.imageUrl)}
            alt=""
            className="h-72 w-full border-2 border-black object-contain"
          />
        </a>
      ) : (
        <div className="grid h-72 place-items-center border-2 border-black bg-white">
          <Skull className="h-12 w-12" />
        </div>
      )}
      <div>
        <h3 className="font-black">{creature.name}</h3>
        <p className="text-xs uppercase">{creature.preferredEnvironment}</p>
        <p className="mt-2 font-bold">
          {[
            armorClass ? `Armor Class ${armorClass}` : "",
            hitPoints
              ? `Hit Points ${currentHp ?? hitPoints}/${hitPoints}`
              : "",
            speed ? `Speed ${speed}` : "",
            initiative ? `Initiative ${initiative}` : "",
          ]
            .filter(Boolean)
            .join(" / ") || "Stats pending"}
        </p>
        {abilityStats.some(([, value]) => typeof value === "number") ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {abilityStats.map(([label, value]) => (
              <div
                key={label}
                className="border-2 border-black bg-[#f8f4e8] p-2 text-center"
              >
                <p className="text-[11px] font-black leading-4">{label}</p>
                <p className="font-black">{value ?? "-"}</p>
                {typeof value === "number" ? (
                  <p className="text-xs font-black">
                    Modifier {signedModifier(abilityModifier(value))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {showKeyItems && encounterCreature?.keyItems?.length ? (
          <div className="mt-3 border-2 border-black bg-[#f8f4e8] p-3">
            <p className="mb-2 text-xs font-black uppercase">
              Loot, Gear & Key Items
            </p>
            <ul className="grid gap-1 pl-4 font-semibold">
              {encounterCreature.keyItems.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function getCurrentTurnActor(encounter: Encounter) {
  const order = encounter.ruleNotes?.turnOrder ?? [];
  return order[encounter.ruleNotes?.currentTurnIndex ?? 0];
}
