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
import { ToggleSubtaskDto } from './dto/subtask.dto';

@Controller('trackers')
@UseGuards(AuthGuard('jwt'))
export class TrackersController {
  constructor(private readonly trackerService: TrackersService) {}

  // ===================================
  // СПЕЦИФИЧНЫЕ РОУТЫ (БЕЗ ПАРАМЕТРОВ) - ВВЕРХУ!
  // ===================================

  // Toggle подзадачи
  @Patch('toggle')
  toggleSubtask(@Body() dto: ToggleSubtaskDto) {
    return this.trackerService.toggleSubtask(dto);
  }

  // Создать задачу
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  createTask(@Body() dto: CreateTrackerTaskDto) {
    return this.trackerService.createTask(dto);
  }

  // ===================================
  // РОУТЫ С ПАРАМЕТРАМИ - ВНИЗУ!
  // ===================================

  // Получить все задачи студента
  @Get(':id')
  getTasks(@Param('id', ParseIntPipe) userId: number) {
    return this.trackerService.getStudentTasks(userId);
  }

  // Переместить задачу (должен быть ВЫШЕ @Patch(':taskId'))
  @Patch(':taskId/move')
  moveTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: MoveTrackerTaskDto,
  ) {
    return this.trackerService.moveTask(taskId, dto);
  }

  // Обновить задачу
  @Patch(':taskId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTrackerTaskDto,
  ) {
    return this.trackerService.updateTask(taskId, dto);
  }

  // Удалить задачу
  @Delete(':taskId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.trackerService.deleteTask(taskId);
  }
}
