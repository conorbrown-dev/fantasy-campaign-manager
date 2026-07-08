ALTER TABLE "EncounterCreature"
  ADD COLUMN "armorClass" INTEGER,
  ADD COLUMN "maxHitPoints" INTEGER,
  ADD COLUMN "speed" INTEGER,
  ADD COLUMN "strength" INTEGER,
  ADD COLUMN "dexterity" INTEGER,
  ADD COLUMN "constitution" INTEGER,
  ADD COLUMN "intelligence" INTEGER,
  ADD COLUMN "wisdom" INTEGER,
  ADD COLUMN "charisma" INTEGER,
  ADD COLUMN "keyItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
