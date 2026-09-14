-- CreateEnum
CREATE TYPE "MachineState" AS ENUM ('run', 'idle', 'down', 'offline');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Machine" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Machine" ALTER COLUMN "state" TYPE "MachineState" USING (
  CASE
    WHEN "state" IN ('run', 'idle', 'down', 'offline') THEN "state"
    ELSE 'offline'
  END
)::"MachineState";
ALTER TABLE "Machine" ALTER COLUMN "state" SET DEFAULT 'offline';

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- AlterForeignKey Invoice.order: keep fiscal history if an order row is deleted
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey WorkOrder.order: keep production history if an order row is deleted
ALTER TABLE "WorkOrder" DROP CONSTRAINT "WorkOrder_orderId_fkey";
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterForeignKey StockMovement.material: keep the stock ledger if a material is deleted
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_materialId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
