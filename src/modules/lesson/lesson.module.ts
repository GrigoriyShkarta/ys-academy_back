import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { FileModule } from '../file/file.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [FileModule, EmailModule],
  providers: [LessonService],
  controllers: [LessonController],
})
export class LessonModule {}
