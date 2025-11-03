import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller('lesson')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(AnyFilesInterceptor())
  async createLesson(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Предполагается, что createLesson ожидает JSON, а не FormData
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dto: CreateLessonDto = JSON.parse(JSON.stringify(body));

    // Сопоставляем файлы с полями content
    dto.blocks = dto.blocks || [];
    dto.blocks.forEach((block, blockIndex) => {
      block.items = block.items || [];
      block.items.forEach((item, itemIndex) => {
        const matchedFile = files.find(
          (f) =>
            f.fieldname ===
            `blocks[${blockIndex}][items][${itemIndex}][content]`,
        );
        if (matchedFile) {
          item.content = matchedFile;
        }
      });
    });

    return this.lessonService.createLesson(dto);
  }

  @Post('update/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(AnyFilesInterceptor())
  async updateLesson(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Param('id') id: number,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dto: UpdateLessonDto = JSON.parse(JSON.stringify(body));

    dto.blocks = dto.blocks || [];
    dto.blocks.forEach((block, blockIndex) => {
      block.items = block.items || [];
      block.items.forEach((item, itemIndex) => {
        const matchedFile = files.find(
          (f) =>
            f.fieldname ===
            `blocks[${blockIndex}][items][${itemIndex}][content]`,
        );
        if (matchedFile) {
          item.content = matchedFile;
        }
      });
    });

    return this.lessonService.updateLesson(id, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteLesson(@Param('id') id: number) {
    return this.lessonService.deleteLesson(id);
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
