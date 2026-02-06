import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AbonementDto } from './dto/abonement.dto';
import { CreateStudentSubscriptionDto } from './dto/student-subscription.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import {
  UpdateLessonStatus,
  UpdateUserLessonStatusDto,
} from './dto/update-user-lesson-status.dto';
import { UpdateStudentSubscriptionDto } from './dto/update-user-subscription.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(data: AbonementDto) {
    await this.prisma.subscription.create({ data });

    return true;
  }

  async update(id: number, data: AbonementDto) {
    await this.prisma.subscription.update({ where: { id }, data });

    return true;
  }

  async delete(ids: number[]) {
    await this.prisma.subscription.deleteMany({ where: { id: { in: ids } } });
  }

  async getAll(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;
    const where = {
      title: search
        ? {
            contains: search,
            mode: 'insensitive' as const,
          }
        : undefined,
    };

    const totalCount = await this.prisma.audio.count({ where });

    // безопасная валидация полей сортировки
    const allowedFields = new Set(['id', 'title', 'createdAt']);
    const orderField =
      sortBy && allowedFields.has(sortBy)
        ? (sortBy as keyof typeof allowedFields)
        : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      skip: isAll ? undefined : skip, // ⬅️ Более явно
      take: isAll ? undefined : take, // ⬅️ Более явно
      orderBy: { [orderField]: order },
    });

    const totalPages = isAll ? 1 : Math.ceil(totalCount / take);

    return {
      data: subscriptions,
      meta: {
        currentPage: isAll ? 'all' : page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  async createStudentSubscription(dto: CreateStudentSubscriptionDto) {
    const { userId, subscriptionId, lessonDates } = dto;

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    if (lessonDates && lessonDates?.length > 0 && lessonDates?.length !== subscription.lessons_count) {
      throw new BadRequestException(
        'Количество дат должно соответствовать количеству уроков',
      );
    }

    await this.prisma.userSubscription.create({
      data: {
        userId,
        subscriptionId,
        paymentStatus: 'unpaid',
        lessonDays: dto?.lessonDays,
        lessonDates: lessonDates?.map((date) => new Date(date)),
        lessons: {
          create: lessonDates?.map((date) => ({
            scheduledAt: new Date(date),
            status: 'pending',
          })),
        },
      },
      include: { lessons: true },
    });

    return true;
  }

  async updateStudentSubscription(
    userSubscriptionId: number,
    dto: UpdateStudentSubscriptionDto,
  ) {
    const { subscriptionId, lessonDates, paymentStatus, amount } = dto;

    // Находим текущую подписку студента с уроками
    const existingSubscription = await this.prisma.userSubscription.findUnique({
      where: { id: userSubscriptionId },
      include: { lessons: true, subscription: true },
    });

    if (!existingSubscription) {
      throw new BadRequestException('User subscription not found');
    }

    // Если меняется абонемент — проверяем новый
    if (
      subscriptionId &&
      subscriptionId !== existingSubscription.subscriptionId
    ) {
      const newSubscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!newSubscription) {
        throw new BadRequestException('New subscription not found');
      }

      // Проверяем количество дат
      if (lessonDates && lessonDates.length !== newSubscription.lessons_count) {
        throw new BadRequestException(
          `Количество дат должно быть равно ${newSubscription.lessons_count}`,
        );
      }
    }

    // Если передаются новые даты — проверяем их количество
    if (lessonDates) {
      let targetLessonsCount: number;

      if (
        subscriptionId &&
        subscriptionId !== existingSubscription.subscriptionId
      ) {
        const newSubscription = await this.prisma.subscription.findUnique({
          where: { id: subscriptionId },
        });

        if (!newSubscription) {
          throw new BadRequestException('New subscription not found');
        }

        targetLessonsCount = newSubscription.lessons_count;
      } else {
        targetLessonsCount = existingSubscription.subscription.lessons_count;
      }

      if (lessonDates.length !== targetLessonsCount) {
        throw new BadRequestException(
          `Количество дат должно быть равно ${targetLessonsCount}`,
        );
      }
    }

    // Обновляем подписку и уроки в транзакции
    return this.prisma.$transaction(async (tx) => {
      // 1. Удаляем старые уроки, если передаются новые даты
      if (lessonDates) {
        await tx.userLesson.deleteMany({
          where: { userSubscriptionId },
        });
      }

      // 2. Обновляем основную информацию подписки
      await tx.userSubscription.update({
        where: { id: userSubscriptionId },
        data: {
          subscriptionId: subscriptionId ?? existingSubscription.subscriptionId,
          paymentStatus: paymentStatus ?? existingSubscription.paymentStatus,
          amount:
            paymentStatus === 'paid' || paymentStatus === 'unpaid'
              ? 0
              : (amount ?? existingSubscription.amount),
          // Создаём новые уроки, если переданы даты
          lessons: lessonDates
            ? {
                create: lessonDates.map((date) => ({
                  scheduledAt: new Date(date),
                  status: 'pending',
                })),
              }
            : undefined,
          lessonDays: dto.lessonDays ?? existingSubscription.lessonDays,
          lessonDates: lessonDates
            ? lessonDates.map((date) => new Date(date))
            : undefined,
        },
        include: {
          lessons: true,
          subscription: true,
        },
      });

      return true;
    });
  }

  async deleteStudentSubscription(id: number) {
    // Находим подписку студента
    const userSubscription = await this.prisma.userSubscription.findUnique({
      where: { id },
      include: { lessons: true }, // если нужно удалить связанные уроки
    });

    if (!userSubscription) {
      throw new BadRequestException('Student subscription not found');
    }

    // Удаляем связанные уроки (если есть отдельная модель UserLesson)
    if (userSubscription.lessons && userSubscription.lessons.length > 0) {
      await this.prisma.userLesson.deleteMany({
        where: { userSubscriptionId: id },
      });
    }

    // Удаляем саму подписку студента
    await this.prisma.userSubscription.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Student subscription deleted successfully',
    };
  }

  async updatePaymentStatus(
    userSubscriptionId: number,
    dto: UpdatePaymentStatusDto,
  ) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { id: userSubscriptionId },
    });

    if (!subscription) {
      throw new BadRequestException('User subscription not found');
    }

    return this.prisma.userSubscription.update({
      where: { id: userSubscriptionId },
      data: {
        paymentStatus: dto.paymentStatus,
        paymentDate:
          dto?.paymentDate ?? null,
        amount:
          dto.paymentStatus === 'paid' || dto.paymentStatus === 'unpaid'
            ? 0
            : dto.amount,
      },
    });
  }

  async updateLessonStatus(
    userLessonId: number,
    dto: UpdateUserLessonStatusDto,
  ) {
    const lesson = await this.prisma.userLesson.findUnique({
      where: { id: userLessonId },
    });

    if (!lesson) {
      throw new BadRequestException('User lesson not found');
    }

    // Валидация бизнес-логики
    if (dto.status === UpdateLessonStatus.TRANSFERRED && !dto.transferredTo) {
      throw new BadRequestException(
        'transferredTo is required when status is TRANSFERRED',
      );
    }

    const data = {
      status: dto.status,
      completedAt: lesson.completedAt,
      transferredTo: lesson.transferredTo,
      scheduledAt: lesson.scheduledAt,
    };

    // Если урок проведён
    if (dto.status === UpdateLessonStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    // Если урок перенесён
    if (dto.status === UpdateLessonStatus.TRANSFERRED) {
      const newDate = new Date(dto.transferredTo!);

      data.transferredTo = newDate;
      data.scheduledAt = newDate;
    }

    return this.prisma.userLesson.update({
      where: { id: userLessonId },
      data,
    });
  }

  async addRecordingToLesson(
    lessonId: number,
    recordingUrl: string,
    userId: number,
  ) {
    const lesson = await this.prisma.userLesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new BadRequestException('Lesson not found');
    }

    await this.prisma.notification.create({
      data: {
        userId,
        title: 'lesson_record',
      },
    });

    // Отправка email-уведомлений для новых записей урока
    await this.emailService.sendUserLessonNotification(userId);

    return this.prisma.userLesson.update({
      where: { id: lessonId },
      data: {
        recordingUrl,
      },
    });
  }

  async updateRecordingToLesson(lessonId: number, recordingUrl: string) {
    const lesson = await this.prisma.userLesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new BadRequestException('Lesson not found');
    }

    await this.prisma.userLesson.update({
      where: { id: lessonId },
      data: {
        recordingUrl,
      },
    });

    return true;
  }

  async deleteRecordingFromLesson(lessonId: number) {
    const lesson = await this.prisma.userLesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new BadRequestException('Lesson not found');
    }

    await this.prisma.userLesson.update({
      where: { id: lessonId },
      data: { recordingUrl: null },
    });

    return true;
  }
}
