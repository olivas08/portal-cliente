-- CreateTable
CREATE TABLE "OperationType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "ratePerUnitEur" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationType_key_key" ON "OperationType"("key");

-- Seed the 4 operation types that used to be hard-coded rate columns on
-- PricingSettings/QuoteLine, carrying over each existing rate so already
-- quoted math doesn't change. From here on they're fully editable/extendable
-- on /admin/orcamentos/definicoes without a code change.
INSERT INTO "OperationType" ("id", "key", "name", "unit", "ratePerUnitEur", "active", "sequence", "updatedAt")
SELECT 'op-corte-laser', 'corte_laser', 'Corte a laser', 'min',
       COALESCE((SELECT "laserEurPerMinute" FROM "PricingSettings" WHERE id = 'default'), 0.9),
       true, 1, CURRENT_TIMESTAMP
UNION ALL
SELECT 'op-quinagem', 'quinagem', 'Quinagem', 'dobra',
       COALESCE((SELECT "bendEurPerBend" FROM "PricingSettings" WHERE id = 'default'), 1.5),
       true, 2, CURRENT_TIMESTAMP
UNION ALL
SELECT 'op-soldadura', 'soldadura', 'Soldadura', 'min',
       COALESCE((SELECT "weldingEurPerMinute" FROM "PricingSettings" WHERE id = 'default'), 1.2),
       true, 3, CURRENT_TIMESTAMP
UNION ALL
SELECT 'op-acabamento', 'acabamento', 'Acabamento', 'm²',
       COALESCE((SELECT "finishingEurPerM2" FROM "PricingSettings" WHERE id = 'default'), 8),
       true, 4, CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "QuoteLineOperation" (
    "id" TEXT NOT NULL,
    "quoteLineId" TEXT NOT NULL,
    "operationTypeId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "ratePerUnitEur" DOUBLE PRECISION NOT NULL,
    "costEur" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "QuoteLineOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteLineOperation_quoteLineId_idx" ON "QuoteLineOperation"("quoteLineId");

-- CreateIndex
CREATE INDEX "QuoteLineOperation_operationTypeId_idx" ON "QuoteLineOperation"("operationTypeId");

-- AddForeignKey
ALTER TABLE "QuoteLineOperation" ADD CONSTRAINT "QuoteLineOperation_quoteLineId_fkey" FOREIGN KEY ("quoteLineId") REFERENCES "QuoteLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineOperation" ADD CONSTRAINT "QuoteLineOperation_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "OperationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing QuoteLine operation columns into QuoteLineOperation rows
-- (one row per non-zero driver), preserving historical quote costs exactly.
INSERT INTO "QuoteLineOperation" ("id", "quoteLineId", "operationTypeId", "name", "unit", "quantity", "ratePerUnitEur", "costEur")
SELECT gen_random_uuid()::text, ql."id", ot."id", ot."name", ot."unit", ql."laserMinutes", ot."ratePerUnitEur", ql."laserMinutes" * ot."ratePerUnitEur"
FROM "QuoteLine" ql JOIN "OperationType" ot ON ot."key" = 'corte_laser'
WHERE ql."laserMinutes" > 0;

INSERT INTO "QuoteLineOperation" ("id", "quoteLineId", "operationTypeId", "name", "unit", "quantity", "ratePerUnitEur", "costEur")
SELECT gen_random_uuid()::text, ql."id", ot."id", ot."name", ot."unit", ql."bendCount", ot."ratePerUnitEur", ql."bendCount" * ot."ratePerUnitEur"
FROM "QuoteLine" ql JOIN "OperationType" ot ON ot."key" = 'quinagem'
WHERE ql."bendCount" > 0;

INSERT INTO "QuoteLineOperation" ("id", "quoteLineId", "operationTypeId", "name", "unit", "quantity", "ratePerUnitEur", "costEur")
SELECT gen_random_uuid()::text, ql."id", ot."id", ot."name", ot."unit", ql."weldingMinutes", ot."ratePerUnitEur", ql."weldingMinutes" * ot."ratePerUnitEur"
FROM "QuoteLine" ql JOIN "OperationType" ot ON ot."key" = 'soldadura'
WHERE ql."weldingMinutes" > 0;

INSERT INTO "QuoteLineOperation" ("id", "quoteLineId", "operationTypeId", "name", "unit", "quantity", "ratePerUnitEur", "costEur")
SELECT gen_random_uuid()::text, ql."id", ot."id", ot."name", ot."unit", ql."finishingM2", ot."ratePerUnitEur", ql."finishingM2" * ot."ratePerUnitEur"
FROM "QuoteLine" ql JOIN "OperationType" ot ON ot."key" = 'acabamento'
WHERE ql."finishingM2" > 0;

-- AlterTable: drop the now-obsolete fixed operation columns from QuoteLine
ALTER TABLE "QuoteLine" DROP COLUMN "operation";
ALTER TABLE "QuoteLine" DROP COLUMN "laserMinutes";
ALTER TABLE "QuoteLine" DROP COLUMN "bendCount";
ALTER TABLE "QuoteLine" DROP COLUMN "weldingMinutes";
ALTER TABLE "QuoteLine" DROP COLUMN "finishingM2";

-- AlterTable: drop the now-obsolete fixed rate columns from PricingSettings
ALTER TABLE "PricingSettings" DROP COLUMN "laserEurPerMinute";
ALTER TABLE "PricingSettings" DROP COLUMN "bendEurPerBend";
ALTER TABLE "PricingSettings" DROP COLUMN "weldingEurPerMinute";
ALTER TABLE "PricingSettings" DROP COLUMN "finishingEurPerM2";

-- DropEnum
DROP TYPE "QuoteOperation";
