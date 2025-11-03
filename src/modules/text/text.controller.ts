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
import { TextService } from './text.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

@Controller('text')
export class TextController {
  constructor(private readonly textService: TextService) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  uploadVideo(
    @Body('title') title: string,
    @Body('content') content: string, // <--- заменили videoUrl на file
    @Req() req: RequestWithUser,
  ) {
    return this.textService.uploadText(content, title, req.user.id);
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

    return this.textService.getAllText(pageParam, search || '');
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async updateText(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('content') content: string,
  ) {
    return this.textService.updateText(+id, title, content);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteText(@Body('ids') ids: number[]) {
    return this.textService.deleteText(ids);
  }
}
