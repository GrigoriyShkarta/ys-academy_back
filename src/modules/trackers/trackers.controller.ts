import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import {
  CreateTrackerTaskDto,
  MoveTrackerTaskDto,
  UpdateTrackerTaskDto,
} from './dto/tracker.dto';
import { TrackersService } from './trackers.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('trackers')
@UseGuards(AuthGuard('jwt'))
export class TrackersController {
  constructor(private readonly trackerService: TrackersService) {}

  // Получить все задачи текущего пользователя
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getTasks(@Param('id') userId: number) {
    return this.trackerService.getStudentTasks(userId);
  }

  // Создать задачу
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  createTask(@Body() dto: CreateTrackerTaskDto) {
    return this.trackerService.createTask(dto);
  }

  // Обновить задачу
  @Patch(':taskId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTrackerTaskDto,
  ) {
    return this.trackerService.updateTask(taskId, dto);
  }

  // Удалить задачу
  @Delete(':taskId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.trackerService.deleteTask(taskId);
  }

  // Переместить задачу
  @Patch(':taskId/move')
  @UseGuards(AuthGuard('jwt'))
  moveTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: MoveTrackerTaskDto,
  ) {
    return this.trackerService.moveTask(taskId, dto);
  }
}
