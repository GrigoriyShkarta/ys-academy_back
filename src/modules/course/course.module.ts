import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [CourseController],
  providers: [CourseService],
})
export class CourseModule {}
