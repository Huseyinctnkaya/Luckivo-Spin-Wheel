-- AlterTable
-- Prisma bu değişiklik için tabloyu yeniden inşa eden (CREATE/INSERT/DROP/RENAME)
-- bir migration üretiyor. Sabit varsayılanlı kolon eklemeyi SQLite doğrudan
-- desteklediği için, production verisine dokunmayan atomik hali tercih edildi.
ALTER TABLE "Shop" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;
