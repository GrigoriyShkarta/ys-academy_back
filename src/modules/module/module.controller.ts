import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModuleDto } from './dto/module.dto';
import { ModuleService } from './module.service';

@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async createModule(
    @Body() body: ModuleDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const dto: ModuleDto = {
      title: body.title,
      url: body?.url,
      lessonsId: body?.lessonsId
        ? Array.isArray(body.lessonsId)
          ? body.lessonsId
          : [body.lessonsId]
        : [],
    };
    return this.moduleService.createModule(dto, image);
  }

  @Post('update/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async updateModule(
    @Param('id') id: number,
    @Body() body: ModuleDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const dto: ModuleDto = {
      title: body.title,
      url: body?.url,
      lessonsId: body?.lessonsId
        ? Array.isArray(body.lessonsId)
          ? body.lessonsId
          : [body.lessonsId]
        : [],
    };
    return this.moduleService.updateModule(id, dto, image);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteModule(@Param('id') id: number) {
    return this.moduleService.deleteModule(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getAllModules(@Query('search') search: string) {
    return this.moduleService.getModules(search || '');
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getModule(@Param('id') id: number) {
    return this.moduleService.getModule(id);
  }
}
