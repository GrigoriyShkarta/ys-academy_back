/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CourseDto } from './dto/course.dto';
import { FileService } from '../file/file.service';

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async createCourse(data: CourseDto) {
    const lessonsPayload = data.lessons ?? [];
    const sortedLessons = [...lessonsPayload].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );

    await this.prisma.course.create({
      data: {
        title: data.title,
        url: data.url ?? '',
        publicImgId: data.publicImgId ?? '',
        categories: data.categories?.length
          ? {
              connect: data.categories.map((id) => ({ id: Number(id) })),
            }
          : undefined,
        modules: data.modules?.length
          ? {
              connect: data.modules.map((m) => ({ id: m.id })),
            }
          : undefined,
        courseLessons: sortedLessons.length
          ? {
              create: sortedLessons.map((lesson, idx) => ({
                lesson: { connect: { id: lesson.id } },
                order: lesson.order ?? idx,
              })),
            }
          : undefined,
      },
      // типы старые – приводим к any, чтобы не ругался TS
    } as any);

    return true;
  }

  async getCourses(params: { search?: string; categories?: string[] }) {
    const { search, categories } = params;

    const where: any = {
      ...(search && {
        title: { contains: search, mode: 'insensitive' },
      }),
      ...(categories?.length
        ? {
            categories: {
              some: { id: { in: categories.map((id) => Number(id)) } },
            },
          }
        : undefined),
    };

    const courses = (await this.prisma.course.findMany({
      where,
      include: {
        modules: {
          select: {
            id: true,
            title: true,
            url: true,
            categories: { select: { id: true, title: true, color: true } },
          },
        },
        courseLessons: {
          orderBy: { order: 'asc' },
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                categories: { select: { id: true, title: true, color: true } },
              },
            },
          },
        },
        categories: { select: { id: true, title: true, color: true } },
      },
    } as any)) as any[];

    // Возвращаем lessons, отсортированные по order
    return courses.map((course) => ({
      ...course,
      lessons: course.courseLessons.map((cl) => ({
        ...cl.lesson,
        order: cl.order,
      })),
    }));
  }

  async updateCourse(id: number, data: CourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    if (course.publicImgId && data?.publicImgId) {
      await this.fileService.deleteFile(course.publicImgId, 'image');
    }

    const lessonsPayload = data.lessons ?? [];
    const sortedLessons = [...lessonsPayload].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );

    await this.prisma.$transaction([
      this.prisma.course.update({
        where: { id },
        data: {
          title: data.title ?? undefined,
          url: data.url ?? undefined,

          // --- категории ---
          categories: {
            set: [],
            ...(data.categories?.length
              ? {
                  connect: data.categories.map((categoryId) => ({
                    id: Number(categoryId),
                  })),
                }
              : {}),
          },

          // --- модули ---
          modules: {
            set: [],
            ...(data.modules?.length
              ? {
                  connect: data.modules.map((module) => ({
                    id: module.id,
                  })),
                }
              : {}),
          },
        },
      }) as any,

      // Полностью пересобираем courseLessons по order
      this.prisma.courseLesson.deleteMany({ where: { courseId: id } }) as any,
      ...(sortedLessons.length
        ? [
            this.prisma.courseLesson.createMany({
              data: sortedLessons.map((lesson, idx) => ({
                courseId: id,
                lessonId: lesson.id,
                order: lesson.order ?? idx,
              })),
            }) as any,
          ]
        : []),
    ]);

    return { access: true };
  }

  async getCourse(id: number, userId?: number) {
    const course = (await this.prisma.course.findUnique({
      where: { id },
      include: {
        categories: {
          select: { id: true, title: true, color: true },
        },
        modules: {
          include: {
            categories: {
              select: { id: true, title: true, color: true },
            },
            moduleLessons: {
              include: {
                lesson: {
                  select: {
                    id: true,
                    title: true,
                    content: true,
                    categories: {
                      select: { id: true, title: true, color: true },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        courseLessons: {
          orderBy: { order: 'asc' },
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                categories: {
                  select: { id: true, title: true, color: true },
                },
                content: true,
              },
            },
          },
        },
      },
    } as any)) as any;

    if (!course) {
      throw new Error('Course not found');
    }

    // Получаем пользователя и проверяем его роль
    let isSuperAdmin = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      isSuperAdmin = user?.role === 'super_admin';
    }

    // Собираем lessonId из ВСЕХ источников
    const lessonIds = [
      // Уроки напрямую из курса
      ...course.courseLessons.map((cl) => cl.lesson.id),
      // Уроки из модулей
      ...course.modules.flatMap((module) =>
        module.moduleLessons.map((ml) => ml.lesson.id),
      ),
    ];

    // Убираем дубликаты
    const uniqueLessonIds = Array.from(new Set(lessonIds));

    // Получаем доступы пользователя (если userId есть и не super_admin)
    console.log('userId', userId);
    console.log('uniqueLessonIds', uniqueLessonIds);

    const accesses =
      userId && !isSuperAdmin
        ? await this.prisma.userLessonAccess.findMany({
            where: {
              userId,
              lessonId: { in: uniqueLessonIds },
            },
            select: {
              lessonId: true,
              blocks: true,
            },
          })
        : [];

    // Map lessonId -> number[] (blockIds)
    const accessMap = new Map<number, number[]>();
    console.log('accesses', accesses);
    accesses.forEach((a) => accessMap.set(a.lessonId, a.blocks));

    // Нормализация структуры content для извлечения blockId
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

    // Формирование модулей
    const modulesWithLessonsAccess = course.modules.map((module) => {
      let totalLessons = 0;
      let lessonsWithAccess = 0;

      const lessons = module.moduleLessons.map((ml) => {
        const lesson = ml.lesson;

        totalLessons++;

        const totalBlocks = normalizeBlocks(lesson.content);

        // Если super_admin - даем доступ ко всем блокам
        const availableBlocks = isSuperAdmin
          ? totalBlocks
          : (accessMap.get(lesson.id) ?? []);

        // Проверка доступа
        const hasAccess =
          isSuperAdmin || (userId ? availableBlocks.length > 0 : true);

        if (hasAccess) lessonsWithAccess++;

        const accessString = isSuperAdmin
          ? `${totalBlocks.length}/${totalBlocks.length}`
          : userId != null
            ? `${availableBlocks.length}/${totalBlocks.length}`
            : `${totalBlocks.length}/${totalBlocks.length}`;

        return {
          ...lesson,
          access: hasAccess,
          accessBlocks: accessString,
        };
      });

      const progress =
        isSuperAdmin || userId == null
          ? 100
          : totalLessons === 0
            ? 0
            : Math.round((lessonsWithAccess / totalLessons) * 100);

      const moduleAccess = isSuperAdmin || lessonsWithAccess > 0;

      return {
        id: module.id,
        title: module.title,
        url: module.url,
        categories: module.categories,
        progress,
        access: moduleAccess, // ⬅️ Используется для сортировки
        lessons,
      };
    });

    // ⬇️ СОРТИРОВКА: Модули с доступом (access: true) вначале
    const sortedModules = modulesWithLessonsAccess.sort((a, b) => {
      // Если оба имеют доступ или оба не имеют - сохраняем исходный порядок
      if (a.access === b.access) return 0;
      // Модули с доступом (true) идут раньше
      return a.access ? -1 : 1;
    });

    // Обрабатываем уроки курса (не в модулях)
    const courseLessonsWithAccess = course.courseLessons.map((cl) => {
      const lesson = cl.lesson;
      const totalBlocks = normalizeBlocks(lesson.content);

      // Если super_admin - даем доступ ко всем блокам
      const availableBlocks = isSuperAdmin
        ? totalBlocks
        : (accessMap.get(lesson.id) ?? []);

      const hasAccess =
        isSuperAdmin || (userId ? availableBlocks.length > 0 : true);

      const accessString = isSuperAdmin
        ? `${totalBlocks.length}/${totalBlocks.length}`
        : userId != null
          ? `${availableBlocks.length}/${totalBlocks.length}`
          : `${totalBlocks.length}/${totalBlocks.length}`;

      return {
        ...lesson,
        order: cl.order,
        access: hasAccess,
        accessBlocks: accessString,
      };
    });

    return {
      id: course.id,
      title: course.title,
      url: course.url,
      categories: course.categories,
      modules: sortedModules, // ⬅️ Отсортированные модули
      lessons: courseLessonsWithAccess,
    };
  }

  async deleteCourse(id: number) {
    const currentCourse = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!currentCourse) {
      throw new Error('Course not found');
    }

    if (currentCourse?.publicImgId) {
      await this.fileService.deleteFile(currentCourse.publicImgId, 'image');
    }

    await this.prisma.course.delete({ where: { id } });
  }

  async reorderCourses(courses: { id: number; order: number }[]) {
    // Проверяем, что все курсы существуют
    const courseIds = courses.map((c) => c.id);
    const existingCourses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true },
    });

    if (existingCourses.length !== courseIds.length) {
      throw new BadRequestException('Some courses not found');
    }

    // Обновляем порядок в транзакции
    await this.prisma.$transaction(
      courses.map((course) =>
        this.prisma.course.update({
          where: { id: course.id },
          data: { order: course.order },
        }),
      ),
    );

    return { success: true };
  }
}
