-- CreateEnum
CREATE TYPE "LessonItemType" AS ENUM ('text', 'video', 'audio', 'image');

-- CreateEnum
CREATE TYPE "LessonItemSource" AS ENUM ('custom', 'bank');

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "blockId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonItem" (
    "id" SERIAL NOT NULL,
    "type" "LessonItemType" NOT NULL,
    "source" "LessonItemSource" NOT NULL,
    "layout" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "audioId" INTEGER,
    "videoId" INTEGER,
    "photoId" INTEGER,
    "textId" INTEGER,
    "lessonId" INTEGER NOT NULL,
    "content" TEXT,

    CONSTRAINT "LessonItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_audioId_key" ON "LessonItem"("audioId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_videoId_key" ON "LessonItem"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_photoId_key" ON "LessonItem"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonItem_textId_key" ON "LessonItem"("textId");

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "Audio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_textId_fkey" FOREIGN KEY ("textId") REFERENCES "Text"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonItem" ADD CONSTRAINT "LessonItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
