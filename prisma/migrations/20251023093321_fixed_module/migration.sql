-- DropForeignKey
ALTER TABLE "public"."Lesson" DROP CONSTRAINT "Lesson_moduleId_fkey";

-- AlterTable
ALTER TABLE "Lesson" ALTER COLUMN "moduleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
