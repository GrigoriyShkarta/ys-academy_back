// src/modules/audio/audio.controller.ts
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
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioService } from './audio.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Req() req: RequestWithUser,
  ) {
    return this.audioService.uploadAudio(file, title, req.user.id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllAudio(@Query('page') page?: string, @Query('search') search?: string) {
    let pageParam: number | 'all' | undefined;

    if (page === 'all') {
      pageParam = 'all';
    } else if (page) {
      const n = Number(page);
      pageParam = Number.isInteger(n) ? n : undefined;
    } else {
      pageParam = undefined;
    }

    return this.audioService.getAllAudio(pageParam, search || '');
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  async updateAudio(
    @Param('id') id: string,
    @Body('title') title: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('file') fileUrl?: string,
  ) {
    // fileOrUrl может быть либо File, либо string
    const fileOrUrl: Express.Multer.File | string | undefined = file ?? fileUrl;
    return this.audioService.updateAudio(+id, title, fileOrUrl);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteAudio(@Body('ids') ids: number[]) {
    return this.audioService.deleteAudio(ids);
  }
}
