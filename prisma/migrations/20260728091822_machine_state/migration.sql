-- Machine live state (RUN/IDLE/DOWN/offline) for downtime + OEE
ALTER TABLE "Machine"
  ADD COLUMN "state" TEXT NOT NULL DEFAULT 'offline',
  ADD COLUMN "stateSince" TIMESTAMP(3);
