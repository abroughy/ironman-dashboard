-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discipline" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "distanceMetres" REAL NOT NULL,
    "avgHeartRate" INTEGER,
    "perceivedEffort" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "stravaActivityId" TEXT,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StravaToken" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoachingSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_stravaActivityId_key" ON "Session"("stravaActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSummary_weekStart_key" ON "CoachingSummary"("weekStart");
