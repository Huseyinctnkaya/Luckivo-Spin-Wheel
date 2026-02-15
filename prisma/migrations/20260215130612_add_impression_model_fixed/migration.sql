-- CreateTable
CREATE TABLE "Impression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wheelId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Impression_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "Wheel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
