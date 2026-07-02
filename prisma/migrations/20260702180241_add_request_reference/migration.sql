-- Add nullable column first so existing rows aren't rejected
ALTER TABLE "Request" ADD COLUMN "reference" TEXT;

-- Backfill existing rows with a deterministic REQ-<year>-<seq> reference,
-- ordered by creation date so numbering matches chronological order.
WITH numbered AS (
  SELECT "id",
         'REQ-' || EXTRACT(YEAR FROM "createdDate")::text || '-' ||
         LPAD(
           ROW_NUMBER() OVER (
             PARTITION BY EXTRACT(YEAR FROM "createdDate")
             ORDER BY "createdDate"
           )::text,
           3,
           '0'
         ) AS ref
  FROM "Request"
)
UPDATE "Request"
SET "reference" = numbered.ref
FROM numbered
WHERE "Request"."id" = numbered."id";

-- Now enforce NOT NULL + uniqueness
ALTER TABLE "Request" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "Request_reference_key" ON "Request"("reference");
