ALTER TYPE "EncounterStatus" RENAME TO "EncounterStatus_old";

CREATE TYPE "EncounterStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'ARCHIVED');

ALTER TABLE "Encounter" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Encounter"
  ALTER COLUMN "status" TYPE "EncounterStatus"
  USING (
    CASE "status"::text
      WHEN 'PLANNED' THEN 'PENDING'
      WHEN 'RESOLVED' THEN 'ARCHIVED'
      ELSE "status"::text
    END
  )::"EncounterStatus";

ALTER TABLE "Encounter" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "EncounterStatus_old";
