-- CreateTable
CREATE TABLE "CustomCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT 'Luckivo Spin Wheel',
    "subject" TEXT NOT NULL DEFAULT '🎁 Your discount code is here!',
    "headerTitle" TEXT NOT NULL DEFAULT 'You Won!',
    "headerSubtitle" TEXT NOT NULL DEFAULT 'Congratulations on your lucky spin',
    "headerEmoji" TEXT NOT NULL DEFAULT '🎡',
    "brandColor" TEXT NOT NULL DEFAULT '#6c5ce7',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomCode_shop_key" ON "CustomCode"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSettings_shop_key" ON "EmailSettings"("shop");
