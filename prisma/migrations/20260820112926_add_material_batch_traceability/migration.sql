-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "tracksBatches" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "materialBatchId" TEXT;

-- CreateTable
CREATE TABLE "MaterialBatch" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "supplierName" TEXT,
    "certificateRef" TEXT,
    "receivedQty" DOUBLE PRECISION NOT NULL,
    "remainingQty" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderMaterialBatch" (
    "id" TEXT NOT NULL,
    "workOrderMaterialId" TEXT NOT NULL,
    "materialBatchId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderMaterialBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialBatch_materialId_idx" ON "MaterialBatch"("materialId");

-- CreateIndex
CREATE INDEX "MaterialBatch_materialId_batchCode_idx" ON "MaterialBatch"("materialId", "batchCode");

-- CreateIndex
CREATE INDEX "WorkOrderMaterialBatch_workOrderMaterialId_idx" ON "WorkOrderMaterialBatch"("workOrderMaterialId");

-- CreateIndex
CREATE INDEX "WorkOrderMaterialBatch_materialBatchId_idx" ON "WorkOrderMaterialBatch"("materialBatchId");

-- CreateIndex
CREATE INDEX "StockMovement_materialBatchId_idx" ON "StockMovement"("materialBatchId");

-- AddForeignKey
ALTER TABLE "MaterialBatch" ADD CONSTRAINT "MaterialBatch_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterialBatch" ADD CONSTRAINT "WorkOrderMaterialBatch_workOrderMaterialId_fkey" FOREIGN KEY ("workOrderMaterialId") REFERENCES "WorkOrderMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterialBatch" ADD CONSTRAINT "WorkOrderMaterialBatch_materialBatchId_fkey" FOREIGN KEY ("materialBatchId") REFERENCES "MaterialBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_materialBatchId_fkey" FOREIGN KEY ("materialBatchId") REFERENCES "MaterialBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
