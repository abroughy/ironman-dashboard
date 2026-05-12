-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "distanceMetres" DOUBLE PRECISION NOT NULL,
    "avgHeartRate" INTEGER,
    "perceivedEffort" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "stravaActivityId" TEXT,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSummary" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_stravaActivityId_key" ON "Session"("stravaActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSummary_weekStart_key" ON "CoachingSummary"("weekStart");
