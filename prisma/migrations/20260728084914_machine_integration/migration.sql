-- Machine integration: direct machine data capture (anti-tamper)

ALTER TABLE "WorkOrderStep"
  ADD COLUMN "declaredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "machineVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "machineId" TEXT;

CREATE TABLE "Machine" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "workstationId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");
CREATE INDEX "Machine_active_idx" ON "Machine"("active");
CREATE INDEX "Machine_workstationId_idx" ON "Machine"("workstationId");

CREATE TABLE "MachineReading" (
  "id" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "goodDelta" INTEGER NOT NULL DEFAULT 0,
  "scrapDelta" INTEGER NOT NULL DEFAULT 0,
  "workOrderStepId" TEXT,
  "producedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineReading_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineReading_machineId_eventId_key" ON "MachineReading"("machineId", "eventId");
CREATE INDEX "MachineReading_machineId_receivedAt_idx" ON "MachineReading"("machineId", "receivedAt");

ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MachineReading" ADD CONSTRAINT "MachineReading_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineReading" ADD CONSTRAINT "MachineReading_workOrderStepId_fkey"
  FOREIGN KEY ("workOrderStepId") REFERENCES "WorkOrderStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
