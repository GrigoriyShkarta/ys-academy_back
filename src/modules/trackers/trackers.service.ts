import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  CreateTrackerTaskDto,
  MoveTrackerTaskDto,
  UpdateTrackerTaskDto,
} from './dto/tracker.dto';
import { TrackerColumnId } from 'generated/prisma/client';

@Injectable()
export class TrackersService {
  constructor(private readonly prisma: PrismaService) {}

  // Получить все задачи студента
  async getStudentTasks(userId: number) {
    return this.prisma.trackerTask.findMany({
      where: { userId },
      include: { subtasks: true },
      orderBy: [{ columnId: 'asc' }, { order: 'asc' }],
    });
  }

  // Создать задачу
  async createTask(dto: CreateTrackerTaskDto) {
    // Получаем максимальный order в колонке
    const maxOrder = await this.prisma.trackerTask.findFirst({
      where: {
        userId: dto.userId,
        columnId: dto.columnId,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (maxOrder?.order ?? -1) + 1;

    return this.prisma.trackerTask.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        columnId: dto.columnId,
        description: dto.description,
        order: newOrder,
        subtasks: dto.subtasks
          ? {
              create: dto.subtasks.map((subtask) => ({
                title: subtask.title,
                completed: subtask?.completed ?? false,
              })),
            }
          : undefined,
      },
      include: { subtasks: true },
    });
  }

  // Обновить задачу
  async updateTask(taskId: number, dto: UpdateTrackerTaskDto) {
    // Проверяем что задача принадлежит пользователю
    const task = await this.prisma.trackerTask.findFirst({
      where: { id: taskId, userId: dto.userId },
      include: { subtasks: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Используем транзакцию для атомарного обновления
    return this.prisma.$transaction(async (tx) => {
      // 1. Обновляем название задачи
      await tx.trackerTask.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto?.description,
        },
      });

      // 2. Если переданы подзадачи, обновляем их
      if (dto.subtasks) {
        // Получаем ID существующих подзадач
        const existingSubtaskIds = task.subtasks.map((s) => s.id);
        const updatedSubtaskIds = dto.subtasks
          .filter((s) => s.id)
          .map((s) => s.id!);

        // Удаляем подзадачи, которых нет в новом списке
        const subtasksToDelete = existingSubtaskIds.filter(
          (id) => !updatedSubtaskIds.includes(id),
        );

        if (subtasksToDelete.length > 0) {
          await tx.trackerSubtask.deleteMany({
            where: {
              id: { in: subtasksToDelete },
              taskId,
            },
          });
        }

        // Обновляем или создаем подзадачи
        for (const subtask of dto.subtasks) {
          if (subtask.id) {
            // Обновляем существующую подзадачу
            await tx.trackerSubtask.update({
              where: { id: subtask.id },
              data: {
                title: subtask.title,
                completed: subtask.completed ?? false,
              },
            });
          } else {
            // Создаем новую подзадачу
            await tx.trackerSubtask.create({
              data: {
                taskId,
                title: subtask.title,
                completed: subtask.completed ?? false,
              },
            });
          }
        }
      }

      // 3. Возвращаем обновленную задачу с подзадачами
      return tx.trackerTask.findUnique({
        where: { id: taskId },
        include: { subtasks: true },
      });
    });
  }

  // Удалить задачу
  async deleteTask(taskId: number) {
    const task = await this.prisma.trackerTask.findFirst({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Пересчитываем order для оставшихся задач в колонке
    await this.prisma.trackerTask.delete({
      where: { id: taskId },
    });

    await this.reorderTasks(task.userId, task.columnId);

    return { success: true };
  }

  // Переместить задачу
  async moveTask(taskId: number, dto: MoveTrackerTaskDto) {
    const task = await this.prisma.trackerTask.findFirst({
      where: { id: taskId, userId: dto.userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const oldColumnId = task.columnId;
    const newColumnId = dto.columnId;

    // Если меняем колонку
    if (oldColumnId !== newColumnId) {
      // Получаем максимальный order в новой колонке
      const maxOrder = await this.prisma.trackerTask.findFirst({
        where: {
          userId: dto.userId,
          columnId: newColumnId,
        },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const newOrder = dto.newOrder ?? (maxOrder?.order ?? -1) + 1;

      await this.prisma.trackerTask.update({
        where: { id: taskId },
        data: {
          columnId: newColumnId,
          order: newOrder,
        },
      });

      // Пересчитываем order в старой колонке
      await this.reorderTasks(dto.userId, oldColumnId);

      // Пересчитываем order в новой колонке
      await this.reorderTasks(dto.userId, newColumnId);
    } else {
      // Перемещение внутри одной колонки
      if (dto.newOrder !== undefined) {
        await this.prisma.trackerTask.update({
          where: { id: taskId },
          data: { order: dto.newOrder },
        });

        await this.reorderTasks(dto.userId, oldColumnId);
      }
    }

    return this.prisma.trackerTask.findUnique({
      where: { id: taskId },
      include: { subtasks: true },
    });
  }

  // Вспомогательная функция для пересчета order
  private async reorderTasks(userId: number, columnId: TrackerColumnId) {
    const tasks = await this.prisma.trackerTask.findMany({
      where: { userId, columnId },
      orderBy: { order: 'asc' },
    });

    await this.prisma.$transaction(
      tasks.map((task, index) =>
        this.prisma.trackerTask.update({
          where: { id: task.id },
          data: { order: index },
        }),
      ),
    );
  }
}
