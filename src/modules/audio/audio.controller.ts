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
    @Body('categoryIds') categoryIdsRaw?: string,
  ) {
    let categoryIds: number[] = [];

    if (categoryIdsRaw) {
      try {
        categoryIds = JSON.parse(categoryIdsRaw) as number[];
      } catch (e) {
        console.error('JSON parse error for categoryIds:', categoryIdsRaw, e);
      }
    }

    return this.audioService.uploadAudio(file, title, req.user.id, categoryIds);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllAudio(
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

    let categoriesFormated: string[] = [];
    if (Number(categories)) {
      categoriesFormated = [String(categories)];
    } else {
      categoriesFormated = categories || [];
    }

    // нормализуем sortOrder
    const order =
      sortOrder && sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return this.audioService.getAllAudio(
      pageParam,
      search || '',
      sortBy,
      order,
      categoriesFormated,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async updateAudio(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('file') fileUrl?: string,
    @Body('categoryIds') categoryIds?: string[],
  ) {
    return this.audioService.updateAudio(+id, title, fileUrl, categoryIds);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteAudio(@Body('ids') ids: number[]) {
    return this.audioService.deleteAudio(ids);
  }
}
