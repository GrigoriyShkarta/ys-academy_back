import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { studentSelect, userSelect } from './select/user.select';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileService } from '../modules/file/file.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  isLessonCompleted(scheduledAt: Date, now: Date) {
    const completedAfter = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
    return now >= completedAfter;
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (
      user?.role === 'student' &&
      user?.accessExpiryDate &&
      new Date(user.accessExpiryDate) < new Date()
    ) {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      throw new UnauthorizedException('validation.user_is_not_active');
    }

    const lastLesson = await this.prisma.userLesson.findFirst({
      where: {
        userSubscription: {
          userId: id,
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
      select: {
        scheduledAt: true,
      },
    });

    if (lastLesson) {
      const lastLessonDate = new Date(lastLesson.scheduledAt);
      const deadline = new Date(
        lastLessonDate.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      if (new Date() > deadline && user?.role === 'student') {
        await this.prisma.user.update({
          where: { id },
          data: { isActive: false },
        });
        throw new UnauthorizedException('validation.user_is_not_active');
      }
    }

    // Проверка дней рождения для суперадмина
    if (user?.role === 'super_admin') {
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth() + 1;

      const studentsWithBirthdays = await this.prisma.user.findMany({
        where: {
          role: 'student',
          isActive: true,
          birthDate: { not: null },
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
        },
      });

      const todayBirthdayStudents = studentsWithBirthdays.filter((s) => {
        const bd = new Date(s.birthDate!);
        return bd.getDate() === day && bd.getMonth() + 1 === month;
      });

      if (todayBirthdayStudents.length > 0) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        for (const student of todayBirthdayStudents) {
          const title = `Сьогодні день народження у учня: ${student.name}`;

          const existingNotification = await this.prisma.notification.findFirst(
            {
              where: {
                userId: id,
                title,
                createdAt: {
                  gte: startOfDay,
                },
              },
            },
          );

          if (!existingNotification) {
            await this.prisma.notification.create({
              data: {
                userId: id,
                title,
              },
            });
          }
        }
      }
    }

    return user;
  }

  async getStudentById(id: number) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    if (!student) return null;

    const now = new Date();

    const lessonsToComplete = student.subscriptions
      .flatMap((sub) => sub.lessons)
      .filter(
        (lesson) =>
          (lesson.status === 'pending' || lesson.status === 'transfer') &&
          this.isLessonCompleted(new Date(lesson.scheduledAt), now),
      );

    if (lessonsToComplete.length > 0) {
      await this.prisma.$transaction(
        lessonsToComplete.map((lesson) =>
          this.prisma.userLesson.update({
            where: { id: lesson.id },
            data: {
              status: 'completed',
              completedAt: now,
            },
          }),
        ),
      );
    }

    const updatedStudent = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    updatedStudent?.subscriptions.forEach((sub) => {
      sub.lessons.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    });

    // Загружаем курсы со всеми модулями и уроками
    const courses = (await this.prisma.course.findMany({
      include: {
        modules: {
          include: {
            categories: { select: { id: true, title: true, color: true } },
            moduleLessons: {
              orderBy: { order: 'asc' },
              include: {
                lesson: {
                  select: {
                    id: true,
                    title: true,
                    content: true,
                  },
                },
              },
            },
          },
        },
        courseModules: {
          select: { moduleId: true, order: true },
        },
        courseLessons: {
          orderBy: { order: 'asc' },
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                content: true,
              },
            },
          },
        },
      },
    } as any)) as any[];

    // Функция для извлечения blockId из content
    const normalizeBlocks = (content: any): number[] => {
      if (!Array.isArray(content)) return [];

      return content
        .filter(
          (x) =>
            x &&
            typeof x === 'object' &&
            !Array.isArray(x) &&
            (typeof x.blockId === 'number' || typeof x.blockId === 'string'),
        )
        .map((x) => Number(x.blockId))
        .filter((n) => Number.isFinite(n));
    };

    const coursesWithAccess = courses.map((course) => {
      let hasCourseAccess = false;
      let totalLessons = 0;
      let lessonsWithAccess = 0;

      // Сортируем модули по порядку из courseModules
      const orderMap = new Map<number, number>(
        course.courseModules.map((cm: any) => [cm.moduleId, cm.order]),
      );

      // Обрабатываем модули
      const modules = course.modules
        .map((module: any) => {
          const lessons = module.moduleLessons.map((ml: any) => {
            const lesson = ml.lesson;
            totalLessons++;

            // Получаем все блоки урока
            const totalBlocks = normalizeBlocks(lesson.content);

            // Находим доступные блоки для пользователя
            const accessRecord = student.userLessonAccesses.find(
              (a) => a.lessonId === lesson.id,
            );

            const availableBlocks = accessRecord?.blocks ?? [];
            const hasAccess = availableBlocks.length > 0;

            if (hasAccess) {
              hasCourseAccess = true;
              lessonsWithAccess++;
            }

            // Формат: \"доступных блоков / всего блоков\"
            const accessString = `${availableBlocks.length}/${totalBlocks.length}`;

            return {
              id: lesson.id,
              title: lesson.title,
              access: hasAccess,
              accessBlocks: availableBlocks,
              accessString: accessString,
            };
          });

          return {
            id: module.id,
            title: module.title,
            categories: module.categories,
            lessons,
          };
        })
        .sort(
          (a: any, b: any) =>
            ((orderMap.get(a.id) as number) ?? 0) -
            ((orderMap.get(b.id) as number) ?? 0),
        );

      // Обрабатываем уроки курса (не в модулях)
      const courseLessons = course.courseLessons.map((cl) => {
        const lesson = cl.lesson;
        totalLessons++;

        // Получаем все блоки урока
        const totalBlocks = normalizeBlocks(lesson.content);

        // Находим доступные блоки для пользователя
        const accessRecord = student.userLessonAccesses.find(
          (a) => a.lessonId === lesson.id,
        );

        const availableBlocks = accessRecord?.blocks ?? [];
        const hasAccess = availableBlocks.length > 0;

        if (hasAccess) {
          hasCourseAccess = true;
          lessonsWithAccess++;
        }

        // Формат: \"доступных блоков / всего блоков\"
        const accessString = `${availableBlocks.length}/${totalBlocks.length}`;

        return {
          id: lesson.id,
          title: lesson.title,
          access: hasAccess,
          accessBlocks: availableBlocks,
          accessString: accessString,
          order: cl.order,
        };
      });

      // Прогресс по курсу
      const progress =
        totalLessons === 0
          ? 0
          : Math.round((lessonsWithAccess / totalLessons) * 100);

      return {
        id: course.id,
        title: course.title,
        url: course.url,
        access: hasCourseAccess,
        progress,
        modules: modules,
        lessons: courseLessons,
      };
    });

    return {
      ...updatedStudent,
      courses: coursesWithAccess,
    };
  }

  async getAllStudents(params: {
    page: number | 'all';
    search?: string;
    limit?: number;
  }) {
    const { page = 1, search = '', limit = 15 } = params;
    const isAll = page === 'all';
    const skip = isAll
      ? undefined
      : (Number(page === 0 ? 1 : page) - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: 'student',
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Получаем всех активных студентов
    const [allStudents, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: studentSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Функция для получения последней даты урока
    const getLastLessonTimestamp = (student: any): number => {
      if (!student.subscriptions || student.subscriptions.length === 0) {
        return 0;
      }

      const allLessons = student.subscriptions.flatMap(
        (sub: any) => sub.lessons || [],
      );

      if (allLessons.length === 0) return 0;

      return Math.max(
        ...allLessons.map((lesson: any) =>
          new Date(lesson.scheduledAt).getTime(),
        ),
      );
    };

    // Получаем текущую временную метку
    const now = Date.now();

    // Сортируем: активные сначала, затем по дате уроков
    allStudents.sort((a, b) => {
      // 1. По активности (активные выше)
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;

      // 2. Если активность одинаковая, по дате уроков
      const dateA = getLastLessonTimestamp(a);
      const dateB = getLastLessonTimestamp(b);

      // Если нет уроков - в конец (внутри своей группы активности)
      if (dateA === 0 && dateB === 0) return 0;
      if (dateA === 0) return 1;
      if (dateB === 0) return -1;

      // Вычисляем разницу с сегодняшним днем (по модулю)
      const diffA = Math.abs(now - dateA);
      const diffB = Math.abs(now - dateB);

      // Чем меньше разница - тем выше в списке
      return diffA - diffB;
    });

    // Применяем пагинацию
    const students = isAll
      ? allStudents
      : allStudents.slice(skip, skip! + limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: students,
      meta: {
        total,
        page,
        totalPages,
        limit,
        activeStudentsCount: allStudents.filter((s) => s.isActive).length,
      },
    };
  }

  async create(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
    });
    return true;
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    photo?: Express.Multer.File,
  ) {
    let photoUrl: string | undefined;
    let photoPublicId: string | undefined;

    if (photo) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (user?.photoId) {
        await this.fileService.deleteFile(user.photoId, 'image');
      }

      const uploaded = await this.fileService.uploadFile(photo, 'image', true);
      photoUrl = uploaded.url;
      photoPublicId = uploaded.public_id;
    }

    // Подготавливаем данные для обновления
    const updateData = {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      accessExpiryDate: dto.accessExpiryDate
        ? new Date(dto.accessExpiryDate)
        : undefined,
      photo: photoUrl,
      photoId: photoPublicId,
    };

    // Хешируем пароль, если он передан
    if (dto?.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (user?.photoId) {
      await this.fileService.deleteFile(user.photoId, 'image');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return true;
  }

  async roadNotifications(notificationIds: number[]) {
    await this.prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
      },
      data: { read: true },
    });

    return { success: true };
  }
  async deleteNotifications(notificationId: number) {
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
    return true;
  }
}
