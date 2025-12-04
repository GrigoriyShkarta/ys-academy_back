import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VideoService } from './video.service';
import { RequestWithUser } from '../../common/types/request-with-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; file?: string; videoUrl?: string },
    @Req() req: RequestWithUser,
    @Body('categoryIds') categoryIdsRaw?: string,
  ) {
    const title = body.title ?? '';
    const videoUrl = typeof body.file === 'string' ? body.file : body.videoUrl;

    let categoryIds: number[] = [];

    if (categoryIdsRaw) {
      try {
        categoryIds = JSON.parse(categoryIdsRaw) as number[];
      } catch (e) {
        console.error('JSON parse error for categoryIds:', categoryIdsRaw, e);
      }
    }
    return this.videoService.uploadVideo(
      title,
      req.user.id,
      file,
      videoUrl,
      categoryIds,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllAudio(
    @Query('page') page: string,
    @Query('search') search: string,
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

    let categoriesFormated: string[] = [];
    if (Number(categories)) {
      categoriesFormated = [String(categories)];
    } else {
      categoriesFormated = categories || [];
    }

    return this.videoService.getAllVideo(
      pageParam,
      search || '',
      categoriesFormated,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async updateVideo(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('videoUrl') videoUrl: string,
    @Body('categories') categoryIds?: string[],
  ) {
    return this.videoService.updateVideo(+id, title, videoUrl, categoryIds);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteVideo(@Body('ids') ids: number[]) {
    return this.videoService.deleteVideo(ids);
  }
}
