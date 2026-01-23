import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  CreateTrackerTaskDto,
  MoveTrackerTaskDto,
  UpdateTrackerTaskDto,
} from './dto/tracker.dto';
import { TrackerColumnId } from 'generated/prisma/client';
import { ToggleSubtaskDto } from './dto/subtask.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class TrackersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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

    await this.prisma.trackerTask.create({
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

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: 'new_task',
      },
    });

    // Отправка email-уведомления
    await this.emailService.sendTrackerTaskNotification(dto.userId, dto.title);

    return { success: true };
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

      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });

      // Уведомления для супер админа
      await this.prisma.notification.create({
        data: {
          userId: 1,
          title: `student_updated_task_column ${user?.name}`,
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

  async toggleSubtask(dto: ToggleSubtaskDto) {
    // Проверяем что задача принадлежит пользователю
    const task = await this.prisma.trackerTask.findFirst({
      where: { id: dto.taskId, userId: dto.userId },
      include: { subtasks: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const subtask = await this.prisma.trackerSubtask.findFirst({
      where: { id: dto.subtaskId, taskId: dto.taskId },
    });

    if (!subtask) {
      throw new NotFoundException('Subtask not found');
    }

    // Используем транзакцию для атомарного обновления
    return this.prisma.$transaction(async (tx) => {
      // 1. Обновляем статус подзадачи
      await tx.trackerSubtask.update({
        where: { id: dto.subtaskId },
        data: { completed: dto.completed },
      });

      // 2. Получаем все подзадачи задачи (с учетом обновления)
      const allSubtasks = await tx.trackerSubtask.findMany({
        where: { taskId: dto.taskId },
      });

      // Если нет подзадач - ничего не делаем
      if (allSubtasks.length === 0) {
        return tx.trackerTask.findUnique({
          where: { id: dto.taskId },
          include: { subtasks: true },
        });
      }

      // 3. Определяем, в каком "треке" находится задача (обычный или song)
      const isSongTrack = (
        [
          TrackerColumnId.song_plans,
          TrackerColumnId.song_in_progress,
          TrackerColumnId.song_ready,
        ] as TrackerColumnId[]
      ).includes(task.columnId);

      // 4. Определяем новую колонку на основе статуса подзадач
      const completedCount = allSubtasks.filter((s) => s.completed).length;
      const totalCount = allSubtasks.length;

      let newColumnId: TrackerColumnId = task.columnId;

      if (completedCount === 0) {
        // Если нет выполненных подзадач - оставляем как есть
        newColumnId = task.columnId;
      } else if (completedCount === totalCount) {
        // Все подзадачи выполнены
        if (isSongTrack) {
          // Song трек: перемещаем в "song_ready"
          newColumnId = TrackerColumnId.song_ready;
        } else {
          // Обычный трек: перемещаем в "completed"
          newColumnId = TrackerColumnId.completed;
        }
      } else {
        // Есть хотя бы одна выполненная подзадача (но не все)
        if (isSongTrack) {
          // Song трек: перемещаем в "song_in_progress"
          newColumnId = TrackerColumnId.song_in_progress;
        } else {
          // Обычный трек: перемещаем в "in_progress"
          newColumnId = TrackerColumnId.in_progress;
        }
      }

      // 5. Если колонка изменилась - перемещаем задачу
      if (newColumnId !== task.columnId) {
        const oldColumnId = task.columnId;

        // Сдвигаем все задачи в новой колонке вниз (+1 к order)
        const tasksInNewColumn = await tx.trackerTask.findMany({
          where: {
            userId: dto.userId,
            columnId: newColumnId,
          },
          orderBy: { order: 'asc' },
        });

        // Обновляем order для всех задач в новой колонке (сдвигаем вниз)
        await Promise.all(
          tasksInNewColumn.map((t) =>
            tx.trackerTask.update({
              where: { id: t.id },
              data: { order: t.order + 1 },
            }),
          ),
        );

        // Перемещаем задачу в начало новой колонки (order = 0)
        await tx.trackerTask.update({
          where: { id: dto.taskId },
          data: {
            columnId: newColumnId,
            order: 0, // В начало!
          },
        });

        // Пересчитываем order в старой колонке
        const oldColumnTasks = await tx.trackerTask.findMany({
          where: { userId: dto.userId, columnId: oldColumnId },
          orderBy: { order: 'asc' },
        });

        await Promise.all(
          oldColumnTasks.map((t, index) =>
            tx.trackerTask.update({
              where: { id: t.id },
              data: { order: index },
            }),
          ),
        );

        const user = await this.prisma.user.findUnique({
          where: { id: dto.userId },
        });

        // Уведомления для супер админа
        await this.prisma.notification.create({
          data: {
            userId: 1,
            title: `student_updated_task_column ${user?.name}`,
          },
        });
      }

      return { success: true };
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
