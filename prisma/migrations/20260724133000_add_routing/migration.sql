-- Per-product manufacturing routing.
CREATE TABLE "RoutingOperation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutingOperation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoutingOperation_productId_idx" ON "RoutingOperation"("productId");
CREATE INDEX "RoutingOperation_workstationId_idx" ON "RoutingOperation"("workstationId");

ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
