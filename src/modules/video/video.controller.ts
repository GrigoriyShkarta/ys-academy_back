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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VideoService } from './video.service';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  uploadVideo(
    @Body('title') title: string,
    @Body('file') videoUrl: string, // <--- заменили videoUrl на file
    @Req() req: RequestWithUser,
  ) {
    return this.videoService.uploadVideo(videoUrl, title, req.user.id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllAudio(@Query('page') page: string, @Query('search') search: string) {
    let pageParam: number | 'all' | undefined;

    if (page === 'all') {
      pageParam = 'all';
    } else if (page) {
      const n = Number(page);
      pageParam = Number.isInteger(n) ? n : undefined;
    } else {
      pageParam = undefined;
    }

    return this.videoService.getAllVideo(pageParam, search || '');
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async updateVideo(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('file') videoUrl: string,
  ) {
    return this.videoService.updateVideo(+id, title, videoUrl);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteVideo(@Body('ids') ids: number[]) {
    return this.videoService.deleteVideo(ids);
  }
}
