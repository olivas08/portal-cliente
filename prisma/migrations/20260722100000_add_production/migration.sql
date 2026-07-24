-- Production (Ordens de Fabrico) module

-- New notification type for production stage updates.
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCTION_UPDATE';

-- Production enums
CREATE TYPE "WorkOrderStatus" AS ENUM ('planned', 'released', 'in_progress', 'done');
CREATE TYPE "StepStatus" AS ENUM ('pending', 'in_progress', 'paused', 'done');

-- Workstation
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientStageLabel" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workstation_code_key" ON "Workstation"("code");
CREATE INDEX "Workstation_active_idx" ON "Workstation"("active");

-- Operator
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Operator_active_idx" ON "Operator"("active");

-- WorkOrder
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "productRef" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantityPlanned" DOUBLE PRECISION NOT NULL,
    "quantityDone" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'planned',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkOrder_reference_key" ON "WorkOrder"("reference");
CREATE INDEX "WorkOrder_orderId_idx" ON "WorkOrder"("orderId");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- WorkOrderStep
CREATE TABLE "WorkOrderStep" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'pending',
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityDone" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scrapQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "operatorId" TEXT,

    CONSTRAINT "WorkOrderStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkOrderStep_workOrderId_idx" ON "WorkOrderStep"("workOrderId");
CREATE INDEX "WorkOrderStep_workstationId_status_idx" ON "WorkOrderStep"("workstationId", "status");

-- Foreign keys
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
