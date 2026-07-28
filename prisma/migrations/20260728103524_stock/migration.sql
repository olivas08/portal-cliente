-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderMaterial" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "materialRef" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "requiredQty" DOUBLE PRECISION NOT NULL,
    "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "workOrderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_reference_key" ON "Material"("reference");

-- CreateIndex
CREATE INDEX "Material_active_idx" ON "Material"("active");

-- CreateIndex
CREATE INDEX "BomItem_materialId_idx" ON "BomItem"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "BomItem_productId_materialId_key" ON "BomItem"("productId", "materialId");

-- CreateIndex
CREATE INDEX "WorkOrderMaterial_materialId_idx" ON "WorkOrderMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderMaterial_workOrderId_materialId_key" ON "WorkOrderMaterial"("workOrderId", "materialId");

-- CreateIndex
CREATE INDEX "StockMovement_materialId_createdAt_idx" ON "StockMovement"("materialId", "createdAt");

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterial" ADD CONSTRAINT "WorkOrderMaterial_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderMaterial" ADD CONSTRAINT "WorkOrderMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

