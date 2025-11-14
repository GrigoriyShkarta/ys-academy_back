import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('lesson')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(AnyFilesInterceptor())
  async createLesson(@Body() body: CreateLessonDto) {
    return this.lessonService.createLesson(body);
  }

  @Post('update/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(AnyFilesInterceptor())
  async updateLesson(@Param('id') id: number, @Body() body: CreateLessonDto) {
    return this.lessonService.updateLesson(id, body);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteLesson() {
    return this.lessonService.deleteLesson();
  }

  @Get('unassigned')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async getUnassignedLessons(@Query('search') search: string) {
    return this.lessonService.getUnassignedLessons(search || '');
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getLessonById(@Param('id') id: number) {
    return this.lessonService.getLesson(id);
  }
}
