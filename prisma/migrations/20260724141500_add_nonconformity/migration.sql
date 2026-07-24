-- CreateEnum
CREATE TYPE "NcDisposition" AS ENUM ('rework', 'scrap');

-- CreateEnum
CREATE TYPE "NcStatus" AS ENUM ('open', 'resolved');

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stepId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "disposition" "NcDisposition" NOT NULL,
    "status" "NcStatus" NOT NULL DEFAULT 'open',
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NonConformity_workOrderId_idx" ON "NonConformity"("workOrderId");

-- CreateIndex
CREATE INDEX "NonConformity_status_idx" ON "NonConformity"("status");

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkOrderStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
