-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "QuoteOperation" AS ENUM ('corte_laser', 'quinagem', 'soldadura', 'acabamento', 'outro');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_DECISION';

-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "steelPriceEurKg" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "laserEurPerMinute" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "bendEurPerBend" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "weldingEurPerMinute" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "finishingEurPerM2" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "defaultMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "notes" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "totalEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "orderId" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "operation" "QuoteOperation" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "materialWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laserMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bendCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weldingMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finishingM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCostEur" DOUBLE PRECISION NOT NULL,
    "lineTotalEur" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_reference_key" ON "Quote"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_orderId_key" ON "Quote"("orderId");

-- CreateIndex
CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
