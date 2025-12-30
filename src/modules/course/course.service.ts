import { Injectable } from '@nestjs/common';
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
      },
    });

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

    return this.prisma.course.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        categories: { select: { id: true, title: true, color: true } },
      },
    });
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

    await this.prisma.course.update({
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
    });

    return { access: true };
  }

  async getCourse(id: number, userId?: number) {
    const course = await this.prisma.course.findUnique({
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
              orderBy: { order: 'asc' },
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
            },
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Собираем все lessonId курса
    const lessonIds = course.modules.flatMap((module) =>
      module.moduleLessons.map((ml) => ml.lesson.id),
    );

    // Получаем доступы пользователя (если userId есть)
    const accesses = userId
      ? await this.prisma.userLessonAccess.findMany({
          where: {
            userId,
            lessonId: { in: lessonIds },
          },
          select: {
            lessonId: true,
            blocks: true,
          },
        })
      : [];

    // Map lessonId -> number[] (blockIds)
    const accessMap = new Map<number, number[]>();
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
        const availableBlocks = accessMap.get(lesson.id) ?? [];

        const hasAccess = userId ? availableBlocks.length > 0 : true;

        if (hasAccess) lessonsWithAccess++;

        const accessString =
          userId != null
            ? `${availableBlocks.length}/${totalBlocks.length}`
            : `${totalBlocks.length}/${totalBlocks.length}`;

        return {
          ...lesson,
          access: hasAccess,
          accessBlocks: accessString,
        };
      });

      const progress =
        userId == null
          ? 100
          : totalLessons === 0
            ? 0
            : Math.round((lessonsWithAccess / totalLessons) * 100);

      const moduleAccess = lessonsWithAccess > 0;

      return {
        id: module.id,
        title: module.title,
        url: module.url,
        categories: module.categories,
        progress,
        access: moduleAccess, // <-- важное поле
        lessons,
      };
    });

    return {
      id: course.id,
      title: course.title,
      url: course.url,
      categories: course.categories,
      modules: modulesWithLessonsAccess,
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
}
