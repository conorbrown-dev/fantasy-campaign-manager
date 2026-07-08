import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Save } from "lucide-react";
import type {
  CharacterSheetHistoryEntry,
  CharacterSheetPayload,
  PendingLookup,
  Player,
} from "../domain";
import {
  abilityFields,
  abilityModifier,
  arrayText,
  booleanValue,
  getProficiencyBonus,
  numberFromForm,
  numberValue,
  pendingIds,
  recordValue,
  skillFields,
  signedModifier,
  spellLevelFields,
  splitFreeformList,
  stringValue,
} from "../domain";
import {
  BusyButtonContent,
  SheetChecklist,
  SheetField,
  TextAreaField,
} from "./common";

export function CharacterSheet({
  isPending,
  player,
  history,
  onSave,
  readOnly = false,
}: {
  isPending: PendingLookup;
  player: Player;
  history: CharacterSheetHistoryEntry[];
  onSave?: (playerId: string, payload: CharacterSheetPayload) => Promise<void>;
  readOnly?: boolean;
}) {
  const stats = player.stats ?? {};
  const equipment = player.equipment ?? {};
  const money = player.money ?? {};
  const identity = recordValue(stats.identity);
  const abilityScores = recordValue(stats.abilityScores);
  const savingThrows = recordValue(stats.savingThrows);
  const skills = recordValue(stats.skills);
  const combat = recordValue(stats.combat);
  const personality = recordValue(stats.personality);
  const appearance = recordValue(stats.appearance);
  const spellcasting = recordValue(stats.spellcasting);
  const spellLevels = recordValue(spellcasting.levels);
  const saveLoading = isPending(pendingIds.saveSheet(player.id));
  const initialLevel = numberValue(stats.level, 1);
  const [levelInput, setLevelInput] = useState(String(initialLevel));
  const parsedLevel = levelInput.trim() ? Number(levelInput) : Number.NaN;
  const proficiencyBonus = Number.isFinite(parsedLevel)
    ? getProficiencyBonus(parsedLevel)
    : null;

  useEffect(() => {
    setLevelInput(String(initialLevel));
  }, [initialLevel, player.id]);

  async function submitSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !onSave) {
      return;
    }

    const data = new FormData(event.currentTarget);
    const classAndLevel = String(data.get("classAndLevel") ?? "");
    const race = String(data.get("race") ?? "");
    const featuresAndTraits = String(data.get("featuresAndTraits") ?? "");
    const nextLevel = numberFromForm(data, "level", 1);
    const nextProficiencyBonus = getProficiencyBonus(nextLevel);
    const nextAbilityScores = Object.fromEntries(
      abilityFields.map((field) => [
        field.id,
        numberFromForm(data, field.id, 10),
      ]),
    );
    const nextSavingThrows = Object.fromEntries(
      abilityFields.map((field) => [
        field.id,
        {
          proficient: data.get(`save-${field.id}-proficient`) === "on",
          bonus: numberFromForm(data, `save-${field.id}-bonus`, 0),
        },
      ]),
    );
    const nextSkills = Object.fromEntries(
      skillFields.map((field) => [
        field.id,
        {
          proficient: data.get(`skill-${field.id}-proficient`) === "on",
          bonus: numberFromForm(data, `skill-${field.id}-bonus`, 0),
        },
      ]),
    );
    const attacksAndSpellcasting = [0, 1, 2]
      .map((index) => ({
        name: String(data.get(`attack-${index}-name`) ?? "").trim(),
        attackBonus: String(data.get(`attack-${index}-bonus`) ?? "").trim(),
        damageType: String(data.get(`attack-${index}-damage`) ?? "").trim(),
      }))
      .filter(
        (attack) => attack.name || attack.attackBonus || attack.damageType,
      );
    const levels = Object.fromEntries(
      spellLevelFields.map((level) => [
        level,
        {
          slotsTotal: numberFromForm(data, `spell-${level}-slots-total`, 0),
          slotsExpended: numberFromForm(
            data,
            `spell-${level}-slots-expended`,
            0,
          ),
          spells: splitFreeformList(
            String(data.get(`spell-${level}-names`) ?? ""),
          ),
        },
      ]),
    );

    await onSave(player.id, {
      stats: {
        ...stats,
        characterName: String(data.get("characterName") ?? ""),
        level: nextLevel,
        className: classAndLevel,
        background: String(data.get("background") ?? ""),
        playerName: String(data.get("playerName") ?? ""),
        species: race,
        race,
        alignment: String(data.get("alignment") ?? ""),
        experiencePoints: numberFromForm(data, "experiencePoints", 0),
        inspiration: data.get("inspiration") === "on",
        proficiencyBonus: nextProficiencyBonus,
        strength: nextAbilityScores.strength,
        dexterity: nextAbilityScores.dexterity,
        constitution: nextAbilityScores.constitution,
        intelligence: nextAbilityScores.intelligence,
        wisdom: nextAbilityScores.wisdom,
        charisma: nextAbilityScores.charisma,
        identity: {
          characterName: String(data.get("characterName") ?? ""),
          classAndLevel,
          background: String(data.get("background") ?? ""),
          playerName: String(data.get("playerName") ?? ""),
          race,
          alignment: String(data.get("alignment") ?? ""),
          experiencePoints: numberFromForm(data, "experiencePoints", 0),
        },
        abilityScores: nextAbilityScores,
        savingThrows: nextSavingThrows,
        skills: nextSkills,
        combat: {
          armorClass: numberFromForm(data, "armorClass", 10),
          initiative: numberFromForm(data, "initiative", 0),
          speed: String(data.get("speed") ?? ""),
          hitPointMaximum: numberFromForm(data, "hitPointMaximum", 0),
          currentHitPoints: numberFromForm(data, "currentHitPoints", 0),
          temporaryHitPoints: numberFromForm(data, "temporaryHitPoints", 0),
          hitDiceTotal: String(data.get("hitDiceTotal") ?? ""),
          hitDice: String(data.get("hitDice") ?? ""),
          deathSaveSuccesses: numberFromForm(data, "deathSaveSuccesses", 0),
          deathSaveFailures: numberFromForm(data, "deathSaveFailures", 0),
          passivePerception: numberFromForm(data, "passivePerception", 10),
        },
        personality: {
          traits: String(data.get("personalityTraits") ?? ""),
          ideals: String(data.get("ideals") ?? ""),
          bonds: String(data.get("bonds") ?? ""),
          flaws: String(data.get("flaws") ?? ""),
        },
        appearance: {
          age: String(data.get("age") ?? ""),
          height: String(data.get("height") ?? ""),
          weight: String(data.get("weight") ?? ""),
          eyes: String(data.get("eyes") ?? ""),
          skin: String(data.get("skin") ?? ""),
          hair: String(data.get("hair") ?? ""),
          description: String(data.get("appearance") ?? ""),
          backstory: String(data.get("backstory") ?? ""),
          alliesAndOrganizations: String(
            data.get("alliesAndOrganizations") ?? "",
          ),
          organizationName: String(data.get("organizationName") ?? ""),
          organizationSymbol: String(data.get("organizationSymbol") ?? ""),
          additionalFeatures: String(data.get("additionalFeatures") ?? ""),
        },
        spellcasting: {
          className: String(data.get("spellcastingClass") ?? ""),
          ability: String(data.get("spellcastingAbility") ?? ""),
          saveDc: numberFromForm(data, "spellSaveDc", 0),
          attackBonus: numberFromForm(data, "spellAttackBonus", 0),
          spellsKnown: String(data.get("spellsKnown") ?? ""),
          cantrips: splitFreeformList(String(data.get("cantrips") ?? "")),
          levels,
        },
        sheetInstructionsRead: data.get("sheetInstructionsRead") === "on",
      },
      equipment: {
        ...equipment,
        items: splitFreeformList(String(data.get("items") ?? "")),
        attacksAndSpellcasting,
        otherProficienciesAndLanguages: String(
          data.get("otherProficienciesAndLanguages") ?? "",
        ),
        featuresAndTraits,
        treasure: String(data.get("treasure") ?? ""),
      },
      money: {
        copper: numberFromForm(data, "copper", 0),
        silver: numberFromForm(data, "silver", 0),
        electrum: numberFromForm(data, "electrum", 0),
        gold: numberFromForm(data, "gold", 0),
        platinum: numberFromForm(data, "platinum", 0),
      },
      rolls: player.rolls ?? [],
      abilities: splitFreeformList(featuresAndTraits),
    });
  }

  return (
    <form
      onSubmit={submitSheet}
      noValidate
      className="grid gap-3 border-2 border-black bg-white/85 p-3 text-black shadow-pixel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <BookOpen className="h-4 w-4" />
          {player.name}
        </h3>
        {readOnly ? (
          <span className="border-2 border-black bg-[#f8f4e8] px-3 py-2 text-xs font-black uppercase text-black">
            Read only
          </span>
        ) : (
          <button
            className="pixel-button flex items-center justify-center gap-2 bg-[#348f76] px-3 py-2 text-sm font-bold text-white"
            disabled={saveLoading}
          >
            <BusyButtonContent
              loading={saveLoading}
              loadingLabel="Saving..."
              icon={<Save className="h-4 w-4" />}
            >
              Save
            </BusyButtonContent>
          </button>
        )}
      </div>
      <fieldset disabled={readOnly} className="contents">
        <section className="border-2 border-black bg-[#f8f4e8] p-3 text-sm">
          <h4 className="mb-2 font-black uppercase">How to Fill and Roll</h4>
          <ol className="grid gap-1 pl-5 font-semibold">
            <li className="list-decimal">
              Choose race, class, background, and alignment with your DM.
            </li>
            <li className="list-decimal">
              Roll ability scores using the DM's table method, then assign the
              six scores.
            </li>
            <li className="list-decimal">
              Add ability modifiers to saving throws and skills; check
              proficient boxes granted by class, race, or background.
            </li>
            <li className="list-decimal">
              For attacks, roll a d20 plus the attack bonus; on a hit, roll the
              listed damage dice.
            </li>
            <li className="list-decimal">
              Update hit points, death saves, equipment, treasure, and spell
              slots during play.
            </li>
          </ol>
          <label className="mt-3 flex items-center gap-2 font-black">
            <input
              type="checkbox"
              name="sheetInstructionsRead"
              defaultChecked={booleanValue(stats.sheetInstructionsRead)}
            />
            I have reviewed these steps.
          </label>
        </section>

        <section className="grid gap-3 border-2 border-black bg-white p-3">
          <h4 className="font-pixel text-[11px] leading-5">Character</h4>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            <SheetField
              label="Character Name"
              name="characterName"
              defaultValue={stringValue(
                identity.characterName,
                stringValue(stats.characterName),
              )}
            />
            <SheetField
              label="Class & Level"
              name="classAndLevel"
              defaultValue={stringValue(
                identity.classAndLevel,
                stringValue(stats.className),
              )}
            />
            <SheetField
              label="Level"
              name="level"
              type="number"
              defaultValue={initialLevel}
              value={levelInput}
              onChange={setLevelInput}
              min={1}
            />
            <SheetField
              label="Background"
              name="background"
              defaultValue={stringValue(
                identity.background,
                stringValue(stats.background),
              )}
            />
            <SheetField
              label="Player Name"
              name="playerName"
              defaultValue={stringValue(
                identity.playerName,
                stringValue(stats.playerName, player.name),
              )}
            />
            <SheetField
              label="Race"
              name="race"
              defaultValue={stringValue(
                identity.race,
                stringValue(stats.race, stringValue(stats.species)),
              )}
            />
            <SheetField
              label="Alignment"
              name="alignment"
              defaultValue={stringValue(
                identity.alignment,
                stringValue(stats.alignment),
              )}
            />
            <SheetField
              label="Experience Points"
              name="experiencePoints"
              type="number"
              defaultValue={numberValue(
                identity.experiencePoints,
                numberValue(stats.experiencePoints, 0),
              )}
              min={0}
            />
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[240px_1fr_320px]">
          <div className="grid gap-2 border-2 border-black bg-white p-3">
            <h4 className="font-pixel text-[11px] leading-5">Ability Scores</h4>
            {abilityFields.map((field) => (
              <AbilityScoreField
                key={field.id}
                label={field.label}
                name={field.id}
                defaultValue={numberValue(
                  abilityScores[field.id],
                  numberValue(stats[field.id], 10),
                )}
              />
            ))}
            <label className="flex items-center gap-2 text-sm font-black">
              <input
                type="checkbox"
                name="inspiration"
                defaultChecked={booleanValue(stats.inspiration)}
              />
              Inspiration
            </label>
            <ReadonlySheetField
              label="Proficiency Bonus"
              name="proficiencyBonus"
              type="number"
              value={proficiencyBonus ?? ""}
            />
          </div>

          <div className="grid gap-3 border-2 border-black bg-white p-3">
            <h4 className="font-pixel text-[11px] leading-5">
              Saving Throws & Skills
            </h4>
            <div className="grid gap-2 lg:grid-cols-2">
              <SheetChecklist
                title="Saving Throws"
                fields={abilityFields}
                values={savingThrows}
                namePrefix="save"
              />
              <SheetChecklist
                title="Skills"
                fields={skillFields}
                values={skills}
                namePrefix="skill"
              />
            </div>
            <SheetField
              label="Passive Wisdom (Perception)"
              name="passivePerception"
              type="number"
              defaultValue={numberValue(combat.passivePerception, 10)}
            />
          </div>

          <div className="grid gap-2 border-2 border-black bg-white p-3">
            <h4 className="font-pixel text-[11px] leading-5">Combat</h4>
            <div className="grid grid-cols-3 gap-2">
              <SheetField
                label="Armor Class"
                name="armorClass"
                type="number"
                defaultValue={numberValue(combat.armorClass, 10)}
              />
              <SheetField
                label="Initiative"
                name="initiative"
                type="number"
                defaultValue={numberValue(combat.initiative, 0)}
              />
              <SheetField
                label="Speed"
                name="speed"
                defaultValue={stringValue(combat.speed)}
              />
            </div>
            <SheetField
              label="Hit Point Maximum"
              name="hitPointMaximum"
              type="number"
              defaultValue={numberValue(combat.hitPointMaximum, 0)}
              min={0}
            />
            <div className="grid grid-cols-2 gap-2">
              <SheetField
                label="Current Hit Points"
                name="currentHitPoints"
                type="number"
                defaultValue={numberValue(combat.currentHitPoints, 0)}
                min={0}
              />
              <SheetField
                label="Temporary Hit Points"
                name="temporaryHitPoints"
                type="number"
                defaultValue={numberValue(combat.temporaryHitPoints, 0)}
                min={0}
              />
              <SheetField
                label="Hit Dice Total"
                name="hitDiceTotal"
                defaultValue={stringValue(combat.hitDiceTotal)}
                required={false}
              />
              <SheetField
                label="Hit Dice"
                name="hitDice"
                defaultValue={stringValue(combat.hitDice)}
                required={false}
              />
              <SheetField
                label="Death Saves Successes"
                name="deathSaveSuccesses"
                type="number"
                defaultValue={numberValue(combat.deathSaveSuccesses, 0)}
                min={0}
              />
              <SheetField
                label="Death Saves Failures"
                name="deathSaveFailures"
                type="number"
                defaultValue={numberValue(combat.deathSaveFailures, 0)}
                min={0}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 border-2 border-black bg-white p-3">
            <h4 className="font-pixel text-[11px] leading-5">
              Attacks, Equipment & Proficiencies
            </h4>
            {[0, 1, 2].map((index) => {
              const attack = recordValue(
                Array.isArray(equipment.attacksAndSpellcasting)
                  ? equipment.attacksAndSpellcasting[index]
                  : undefined,
              );
              return (
                <div key={index} className="grid gap-2 md:grid-cols-3">
                  <SheetField
                    label="Name"
                    name={`attack-${index}-name`}
                    defaultValue={stringValue(attack.name)}
                    required={false}
                  />
                  <SheetField
                    label="Atk Bonus"
                    name={`attack-${index}-bonus`}
                    defaultValue={stringValue(attack.attackBonus)}
                    required={false}
                  />
                  <SheetField
                    label="Damage/Type"
                    name={`attack-${index}-damage`}
                    defaultValue={stringValue(attack.damageType)}
                    required={false}
                  />
                </div>
              );
            })}
            <TextAreaField
              label="Equipment"
              name="items"
              rows={4}
              defaultValue={(equipment.items ?? []).join("\n")}
              required={false}
              compact
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["copper", "CP"],
                ["silver", "SP"],
                ["electrum", "EP"],
                ["gold", "GP"],
                ["platinum", "PP"],
              ].map(([coin, label]) => (
                <SheetField
                  key={coin}
                  label={label}
                  name={coin}
                  type="number"
                  defaultValue={money[coin] ?? 0}
                  min={0}
                />
              ))}
            </div>
            <TextAreaField
              label="Other Proficiencies & Languages"
              name="otherProficienciesAndLanguages"
              rows={4}
              defaultValue={stringValue(
                equipment.otherProficienciesAndLanguages,
              )}
              required={false}
              compact
            />
          </div>

          <div className="grid gap-3 border-2 border-black bg-white p-3">
            <h4 className="font-pixel text-[11px] leading-5">
              Personality & Features
            </h4>
            <TextAreaField
              label="Personality Traits"
              name="personalityTraits"
              rows={3}
              defaultValue={stringValue(personality.traits)}
              required={false}
              compact
            />
            <TextAreaField
              label="Ideals"
              name="ideals"
              rows={2}
              defaultValue={stringValue(personality.ideals)}
              required={false}
              compact
            />
            <TextAreaField
              label="Bonds"
              name="bonds"
              rows={2}
              defaultValue={stringValue(personality.bonds)}
              required={false}
              compact
            />
            <TextAreaField
              label="Flaws"
              name="flaws"
              rows={2}
              defaultValue={stringValue(personality.flaws)}
              required={false}
              compact
            />
            <TextAreaField
              label="Features & Traits"
              name="featuresAndTraits"
              rows={5}
              defaultValue={stringValue(
                equipment.featuresAndTraits,
                (player.abilities ?? []).join("\n"),
              )}
              required={false}
              compact
            />
          </div>
        </section>

        <section className="grid gap-3 border-2 border-black bg-white p-3">
          <h4 className="font-pixel text-[11px] leading-5">
            Appearance, Story & Treasure
          </h4>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["age", "Age"],
              ["height", "Height"],
              ["weight", "Weight"],
              ["eyes", "Eyes"],
              ["skin", "Skin"],
              ["hair", "Hair"],
            ].map(([name, label]) => (
              <SheetField
                key={name}
                label={label}
                name={name}
                defaultValue={stringValue(appearance[name])}
                required={false}
              />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <TextAreaField
              label="Character Appearance"
              name="appearance"
              rows={5}
              defaultValue={stringValue(appearance.description)}
              required={false}
              compact
            />
            <TextAreaField
              label="Character Backstory"
              name="backstory"
              rows={5}
              defaultValue={stringValue(appearance.backstory)}
              required={false}
              compact
            />
            <TextAreaField
              label="Allies & Organizations"
              name="alliesAndOrganizations"
              rows={4}
              defaultValue={stringValue(appearance.alliesAndOrganizations)}
              required={false}
              compact
            />
            <TextAreaField
              label="Additional Features & Traits"
              name="additionalFeatures"
              rows={4}
              defaultValue={stringValue(appearance.additionalFeatures)}
              required={false}
              compact
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <SheetField
              label="Organization Name"
              name="organizationName"
              defaultValue={stringValue(appearance.organizationName)}
              required={false}
            />
            <SheetField
              label="Organization Symbol"
              name="organizationSymbol"
              defaultValue={stringValue(appearance.organizationSymbol)}
              required={false}
            />
          </div>
          <TextAreaField
            label="Treasure"
            name="treasure"
            rows={4}
            defaultValue={stringValue(equipment.treasure)}
            required={false}
            compact
          />
        </section>

        <section className="grid gap-3 border-2 border-black bg-white p-3">
          <h4 className="font-pixel text-[11px] leading-5">Spellcasting</h4>
          <div className="grid gap-2 md:grid-cols-4">
            <SheetField
              label="Spellcasting Class"
              name="spellcastingClass"
              defaultValue={stringValue(spellcasting.className)}
              required={false}
            />
            <SheetField
              label="Spellcasting Ability"
              name="spellcastingAbility"
              defaultValue={stringValue(spellcasting.ability)}
              required={false}
            />
            <SheetField
              label="Spell Save DC"
              name="spellSaveDc"
              type="number"
              defaultValue={numberValue(spellcasting.saveDc, 0)}
              required={false}
            />
            <SheetField
              label="Spell Attack Bonus"
              name="spellAttackBonus"
              type="number"
              defaultValue={numberValue(spellcasting.attackBonus, 0)}
              required={false}
            />
          </div>
          <TextAreaField
            label="Spells Known"
            name="spellsKnown"
            rows={3}
            defaultValue={stringValue(spellcasting.spellsKnown)}
            required={false}
            compact
          />
          <TextAreaField
            label="Cantrips"
            name="cantrips"
            rows={3}
            defaultValue={arrayText(spellcasting.cantrips)}
            required={false}
            compact
          />
          <div className="grid gap-2 lg:grid-cols-3">
            {spellLevelFields.map((level) => {
              const levelData = recordValue(spellLevels[level]);
              return (
                <div
                  key={level}
                  className="border-2 border-black bg-[#f8f4e8] p-2"
                >
                  <p className="mb-2 text-xs font-black uppercase">
                    Spell Level {level}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SheetField
                      label="Slots Total"
                      name={`spell-${level}-slots-total`}
                      type="number"
                      defaultValue={numberValue(levelData.slotsTotal, 0)}
                      required={false}
                      min={0}
                    />
                    <SheetField
                      label="Slots Expended"
                      name={`spell-${level}-slots-expended`}
                      type="number"
                      defaultValue={numberValue(levelData.slotsExpended, 0)}
                      required={false}
                      min={0}
                    />
                  </div>
                  <TextAreaField
                    label="Prepared Spell Names"
                    name={`spell-${level}-names`}
                    rows={4}
                    defaultValue={arrayText(levelData.spells)}
                    required={false}
                    compact
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-2 border-black bg-[#f8f4e8] p-3">
          <h4 className="mb-2 font-pixel text-[11px] leading-5">
            Change History
          </h4>
          <div className="grid max-h-56 gap-2 overflow-auto pr-1">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="border-2 border-black bg-white p-2 text-sm"
              >
                <p className="font-black">{entry.summary}</p>
                <p className="text-xs uppercase">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {!history.length ? (
              <p className="border-2 border-black bg-white p-3 text-sm font-bold">
                No saved revisions yet.
              </p>
            ) : null}
          </div>
        </section>
      </fieldset>
    </form>
  );
}

function AbilityScoreField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  const [score, setScore] = useState(String(defaultValue));
  const modifier = abilityModifier(score);

  useEffect(() => {
    setScore(String(defaultValue));
  }, [defaultValue]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2">
      <label className="block text-xs font-black uppercase">
        {label}
        <input
          name={name}
          type="number"
          value={score}
          onChange={(event) => setScore(event.currentTarget.value)}
          className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
        />
      </label>
      <label className="block text-xs font-black uppercase">
        Modifier
        <input
          type="text"
          value={signedModifier(modifier)}
          readOnly
          tabIndex={-1}
          className="mt-1 w-full border-2 border-black bg-[#f8f4e8] p-2 text-center text-sm text-black"
        />
      </label>
    </div>
  );
}

function ReadonlySheetField({
  label,
  name,
  value,
  type = "text",
}: {
  label: string;
  name: string;
  value: string | number;
  type?: string;
}) {
  return (
    <label className="block text-xs font-black uppercase">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        readOnly
        tabIndex={-1}
        className="mt-1 w-full border-2 border-black bg-[#f8f4e8] p-2 text-sm text-black"
      />
    </label>
  );
}
