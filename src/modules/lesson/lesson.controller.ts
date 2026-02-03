import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

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

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteLesson(@Body('ids') ids: number[]) {
    return this.lessonService.deleteLesson(ids);
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
    @Query('categories') categories?: string[],
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

    let categoriesFormated: string[] = [];
    if (Number(categories)) {
      categoriesFormated = [String(categories)];
    } else {
      categoriesFormated = categories || [];
    }

    return this.lessonService.getAllLessons(
      pageParam,
      search || '',
      sortBy,
      order,
      categoriesFormated,
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getLessonById(
    @Param('id') id: number,
    @Req() req: RequestWithUser,
    @Query('checkUserAccess') checkUserAccess?: string,
  ) {
    return this.lessonService.getLesson(
      id,
      req.user.id,
      req.user.role,
      checkUserAccess ? Number(checkUserAccess) : undefined,
    );
  }

  @Post('assign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  assignLesson(
    @Body()
    body: {
      lessonIds: { id: number; blocks?: number[] }[];
      userIds: number[];
      replaceAll?: boolean;
    },
  ) {
    return this.lessonService.grantLessonsAccess(
      body.userIds,
      body.lessonIds,
      body.replaceAll,
    );
  }
}
