import {
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModuleService } from './module.service';

@Controller('module')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async createModule() {
    return this.moduleService.createModule();
  }

  @Post('update/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async updateModule() {
    return this.moduleService.updateModule();
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteModule() {
    return this.moduleService.deleteModule();
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getAllModules() {
    return this.moduleService.getModules();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getModule() {
    return this.moduleService.getModule();
  }
}
