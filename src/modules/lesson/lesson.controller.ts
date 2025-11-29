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
  async deleteLesson(@Param('id') id: number[]) {
    return this.lessonService.deleteLesson(id);
  }

  @Get('unassigned')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async getLessonsWithStudentsAccept(@Query('search') search: string) {
    return this.lessonService.getLessonsWithStudentsAccept(search || '');
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllLessons(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    let pageParam: number | 'all' | undefined;

    if (page === 'all') {
      pageParam = 'all';
    } else if (page) {
      const n = Number(page);
      pageParam = Number.isInteger(n) ? n : undefined;
    } else {
      pageParam = undefined;
    }

    // нормализуем sortOrder
    const order =
      sortOrder && sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return this.lessonService.getAllLessons(
      pageParam,
      search || '',
      sortBy,
      order,
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getLessonById(@Param('id') id: number) {
    return this.lessonService.getLesson(id);
  }

  @Post('assign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  assignLesson(
    @Body()
    body: {
      lessonIds: { id: number; blocks?: number[] }[];
      userIds: number[];
    },
  ) {
    return this.lessonService.grantLessonsAccess(body.userIds, body.lessonIds);
  }
}
