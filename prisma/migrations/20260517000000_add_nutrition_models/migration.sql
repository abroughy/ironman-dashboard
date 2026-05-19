-- CreateTable
CREATE TABLE "NutritionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calorieGoal" INTEGER NOT NULL DEFAULT 3000,
    "weightKg" DOUBLE PRECISION,
    "diet" TEXT NOT NULL DEFAULT 'none',
    "intolerances" TEXT NOT NULL DEFAULT '',
    "mealsPerDay" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionProfile_userId_key" ON "NutritionProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_userId_weekStart_key" ON "MealPlan"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "MealPlan_userId_idx" ON "MealPlan"("userId");

-- AddForeignKey
ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
