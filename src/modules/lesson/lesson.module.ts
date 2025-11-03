import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [LessonService],
  controllers: [LessonController],
})
export class LessonModule {}
