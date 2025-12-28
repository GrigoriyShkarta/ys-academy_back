/*
  Warnings:

  - You are about to drop the column `tags` on the `Audio` table. All the data in the column will be lost.
  - You are about to drop the column `moduleId` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `imgUrl` on the `Module` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the `LessonBlock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LessonItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Text` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'partial_paid', 'unpaid');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'TRANSFERRED', 'TRANSFER_REQUEST');

-- AlterEnum
ALTER TYPE "LessonItemSource" ADD VALUE 'uploaded';

-- DropForeignKey
ALTER TABLE "public"."Lesson" DROP CONSTRAINT "Lesson_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonBlock" DROP CONSTRAINT "LessonBlock_lessonBlockId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_audioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_photoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_textId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_videoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Text" DROP CONSTRAINT "Text_userId_fkey";

-- AlterTable
ALTER TABLE "Audio" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "moduleId",
ADD COLUMN     "content" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "cover" TEXT;

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "imgUrl",
ADD COLUMN     "url" TEXT,
ALTER COLUMN "publicImgId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "goals" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "musicLevel" TEXT,
ADD COLUMN     "photo" TEXT,
ADD COLUMN     "photoId" TEXT,
ADD COLUMN     "previous_refresh_token" TEXT,
ADD COLUMN     "telegram" TEXT,
ADD COLUMN     "vocalExperience" TEXT;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "tags",
ADD COLUMN     "publicId" TEXT;

-- DropTable
DROP TABLE "public"."LessonBlock";

-- DropTable
DROP TABLE "public"."LessonItem";

-- DropTable
DROP TABLE "public"."Text";

-- CreateTable
CREATE TABLE "UserLessonAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "blocks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLessonAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleLesson" (
    "id" SERIAL NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ModuleLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "amount" INTEGER,
    "lessonDates" TIMESTAMP(3)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLesson" (
    "id" SERIAL NOT NULL,
    "userSubscriptionId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "transferredTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "lessons_count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CourseModules" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CourseModules_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ModuleLessons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ModuleLessons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PhotoLessons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PhotoLessons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_VideoLessons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_VideoLessons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AudioCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AudioCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AudioLessons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AudioLessons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PhotoCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PhotoCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_VideoCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_VideoCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LessonCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_LessonCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ModuleCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ModuleCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CourseCategories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CourseCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLessonAccess_userId_lessonId_key" ON "UserLessonAccess"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "ModuleLesson_moduleId_order_idx" ON "ModuleLesson"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleLesson_moduleId_lessonId_key" ON "ModuleLesson"("moduleId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_title_key" ON "Category"("title");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_idx" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "UserSubscription_subscriptionId_idx" ON "UserSubscription"("subscriptionId");

-- CreateIndex
CREATE INDEX "UserLesson_userSubscriptionId_idx" ON "UserLesson"("userSubscriptionId");

-- CreateIndex
CREATE INDEX "UserLesson_scheduledAt_idx" ON "UserLesson"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_title_key" ON "Subscription"("title");

-- CreateIndex
CREATE INDEX "_CourseModules_B_index" ON "_CourseModules"("B");

-- CreateIndex
CREATE INDEX "_ModuleLessons_B_index" ON "_ModuleLessons"("B");

-- CreateIndex
CREATE INDEX "_PhotoLessons_B_index" ON "_PhotoLessons"("B");

-- CreateIndex
CREATE INDEX "_VideoLessons_B_index" ON "_VideoLessons"("B");

-- CreateIndex
CREATE INDEX "_AudioCategories_B_index" ON "_AudioCategories"("B");

-- CreateIndex
CREATE INDEX "_AudioLessons_B_index" ON "_AudioLessons"("B");

-- CreateIndex
CREATE INDEX "_PhotoCategories_B_index" ON "_PhotoCategories"("B");

-- CreateIndex
CREATE INDEX "_VideoCategories_B_index" ON "_VideoCategories"("B");

-- CreateIndex
CREATE INDEX "_LessonCategories_B_index" ON "_LessonCategories"("B");

-- CreateIndex
CREATE INDEX "_ModuleCategories_B_index" ON "_ModuleCategories"("B");

-- CreateIndex
CREATE INDEX "_CourseCategories_B_index" ON "_CourseCategories"("B");

-- AddForeignKey
ALTER TABLE "UserLessonAccess" ADD CONSTRAINT "UserLessonAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonAccess" ADD CONSTRAINT "UserLessonAccess_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLesson" ADD CONSTRAINT "ModuleLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLesson" ADD CONSTRAINT "ModuleLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLesson" ADD CONSTRAINT "UserLesson_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseModules" ADD CONSTRAINT "_CourseModules_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseModules" ADD CONSTRAINT "_CourseModules_B_fkey" FOREIGN KEY ("B") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModuleLessons" ADD CONSTRAINT "_ModuleLessons_A_fkey" FOREIGN KEY ("A") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModuleLessons" ADD CONSTRAINT "_ModuleLessons_B_fkey" FOREIGN KEY ("B") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhotoLessons" ADD CONSTRAINT "_PhotoLessons_A_fkey" FOREIGN KEY ("A") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhotoLessons" ADD CONSTRAINT "_PhotoLessons_B_fkey" FOREIGN KEY ("B") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VideoLessons" ADD CONSTRAINT "_VideoLessons_A_fkey" FOREIGN KEY ("A") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VideoLessons" ADD CONSTRAINT "_VideoLessons_B_fkey" FOREIGN KEY ("B") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AudioCategories" ADD CONSTRAINT "_AudioCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AudioCategories" ADD CONSTRAINT "_AudioCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AudioLessons" ADD CONSTRAINT "_AudioLessons_A_fkey" FOREIGN KEY ("A") REFERENCES "Audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AudioLessons" ADD CONSTRAINT "_AudioLessons_B_fkey" FOREIGN KEY ("B") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhotoCategories" ADD CONSTRAINT "_PhotoCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PhotoCategories" ADD CONSTRAINT "_PhotoCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VideoCategories" ADD CONSTRAINT "_VideoCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VideoCategories" ADD CONSTRAINT "_VideoCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LessonCategories" ADD CONSTRAINT "_LessonCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LessonCategories" ADD CONSTRAINT "_LessonCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModuleCategories" ADD CONSTRAINT "_ModuleCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModuleCategories" ADD CONSTRAINT "_ModuleCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseCategories" ADD CONSTRAINT "_CourseCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseCategories" ADD CONSTRAINT "_CourseCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
