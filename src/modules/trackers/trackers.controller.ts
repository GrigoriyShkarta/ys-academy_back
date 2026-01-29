import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import {
  CreateTrackerTaskDto,
  MoveTrackerTaskDto,
  UpdateTrackerTaskDto,
} from './dto/tracker.dto';
import { TrackersService } from './trackers.service';
import { ToggleSubtaskDto } from './dto/subtask.dto';
import { RequestWithUser } from '../../common/types/request-with-user.interface';

@Controller('trackers')
@UseGuards(AuthGuard('jwt'))
export class TrackersController {
  constructor(private readonly trackerService: TrackersService) {}

  // ===================================
  // СПЕЦИФИЧНЫЕ РОУТЫ (БЕЗ ПАРАМЕТРОВ) - ВВЕРХУ!
  // ===================================

  // Toggle подзадачи
  @Patch('toggle')
  toggleSubtask(@Body() dto: ToggleSubtaskDto, @Req() req: RequestWithUser) {
    return this.trackerService.toggleSubtask(dto, req.user.role);
  }

  // Создать задачу
  @Post()
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
    @Req() req: RequestWithUser,
  ) {
    return this.trackerService.moveTask(taskId, dto, req.user.role);
  }

  // Обновить задачу
  @Patch(':taskId')
  updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTrackerTaskDto,
  ) {
    return this.trackerService.updateTask(taskId, dto);
  }

  // Удалить задачу
  @Delete(':taskId')
  deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.trackerService.deleteTask(taskId);
  }
}
