-- AlterTable: batch number is assigned by the factory during production, so
-- client-created (reorder) orders start without one.
ALTER TABLE "Order" ALTER COLUMN "batchNumber" DROP NOT NULL;
