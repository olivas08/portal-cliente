-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cancelledDate" TIMESTAMP(3),
                    ADD COLUMN "cancelReason" TEXT;
