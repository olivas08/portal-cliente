-- Backfill used DEFAULT CURRENT_TIMESTAMP so existing rows could receive
-- NOT NULL updatedAt. Prisma's @updatedAt has no database default (the
-- client writes the timestamp), matching Order/Request/Product. Drop the
-- leftover defaults so migrate diff agrees with schema.prisma.
ALTER TABLE "Company" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Machine" ALTER COLUMN "updatedAt" DROP DEFAULT;
