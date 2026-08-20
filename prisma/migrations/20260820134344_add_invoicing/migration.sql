-- CreateEnum
CREATE TYPE "InvoiceProvider" AS ENUM ('invoicexpress', 'moloni', 'vendus', 'primavera');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'issued', 'failed', 'cancelled');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCountry" TEXT DEFAULT 'Portugal',
ADD COLUMN     "billingPostalCode" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "InvoiceProvider" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "number" TEXT,
    "pdfUrl" TEXT,
    "totalEur" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
