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
import { FileInterceptor } from '@nestjs/platform-express';
import { ModuleService } from './module.service';
import { ModuleDto } from './dto/module.dto';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async createModule(@Body() body: ModuleDto) {
    return this.moduleService.createModule(body);
  }

  @Post('update/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async updateModule(@Param('id') id: number, @Body() body: ModuleDto) {
    return this.moduleService.updateModule(body, id);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteModule(@Param('id') id: number) {
    return this.moduleService.deleteModule(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getAllModules(@Query('search') search?: string) {
    return this.moduleService.getModules({ search: search || '' });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getModule(@Param('id') id: number, @Req() req: RequestWithUser) {
    return this.moduleService.getModule(id, req.user.id, req.user.role);
  }
}
