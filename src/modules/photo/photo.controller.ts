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
import { FileInterceptor } from '@nestjs/platform-express';
import { RequestWithUser } from '../../common/types/request-with-user.interface';
import { PhotoService } from './photo.service';

@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
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

    return this.photoService.uploadPhoto(file, title, req.user.id, categoryIds);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllPhotos(
    @Query('page') page: string,
    @Query('search') search: string,
    @Query('categories') categories?: string[],
  ) {
    let pageParam: number | 'all' | undefined;

    console.log('check', categories);

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

    console.log('categoriesFormated', categoriesFormated);

    return this.photoService.getAllAPhoto(
      pageParam,
      search || '',
      categoriesFormated,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  async updatePhoto(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('file') fileUrl?: string,
    @Body('categoryIds') categoryIds?: string[],
  ) {
    return this.photoService.updatePhoto(+id, title, fileUrl, categoryIds);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deletePhoto(@Body('ids') ids: number[]) {
    return this.photoService.deletePhoto(ids);
  }
}
