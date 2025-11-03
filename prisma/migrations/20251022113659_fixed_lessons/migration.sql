/*
  Warnings:

  - You are about to drop the column `blockId` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `index` on the `Lesson` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LessonItem" DROP CONSTRAINT "LessonItem_lessonId_fkey";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "blockId",
DROP COLUMN "index";

-- CreateTable
CREATE TABLE "LessonBlock" (
    "id" SERIAL NOT NULL,
    "index" INTEGER NOT NULL,
    "lessonBlockId" INTEGER NOT NULL,

    CONSTRAINT "LessonBlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LessonBlock" ADD CONSTRAINT "LessonBlock_lessonBlockId_fkey" FOREIGN KEY ("lessonBlockId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "LessonBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
