import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ModuleDto } from './dto/module.dto';
import { FileService } from '../file/file.service';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  // ---------------- CREATE MODULE ----------------
  async createModule(data: ModuleDto) {
    const module = await this.prisma.module.create({
      data: {
        title: data.title,
        url: data.url,
        publicImgId: data.publicImgId ?? '',
        categories: data.categories?.length
          ? {
              connect: data.categories.map((id) => ({ id: Number(id) })),
            }
          : undefined,
        moduleLessons: data.lessons?.length
          ? {
              create: data.lessons.map((lesson, index) => ({
                lesson: {
                  connect: { id: lesson.id },
                },
                order: lesson.order ?? index,
              })),
            }
          : undefined,
      },
    });

    return { id: module.id };
  }

  // ---------------- UPDATE MODULE ----------------
  async updateModule(data: ModuleDto, id: number) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        moduleLessons: {
          select: { lessonId: true },
        },
      },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    if (data?.publicImgId && module?.publicImgId) {
      await this.fileService.deleteFile(module.publicImgId, 'image');
    }

    const incomingLessons = data.lessons ?? [];

    const currentLessonIds = module.moduleLessons.map((ml) => ml.lessonId);
    const incomingLessonIds = incomingLessons.map((l) => l.id);

    const lessonsToDelete = currentLessonIds.filter(
      (id) => !incomingLessonIds.includes(id),
    );

    const lessonsToCreate = incomingLessons.filter(
      (l) => !currentLessonIds.includes(l.id),
    );

    const lessonsToUpdate = incomingLessons.filter((l) =>
      currentLessonIds.includes(l.id),
    );

    await this.prisma.$transaction([
      // --- обновляем базовые поля модуля ---
      this.prisma.module.update({
        where: { id },
        data: {
          title: data.title ?? undefined,
          url: data.url ?? undefined,
          publicImgId: data.publicImgId ?? undefined,
          categories: {
            set: [],
            ...(data.categories?.length
              ? {
                  connect: data.categories.map((cId) => ({
                    id: Number(cId),
                  })),
                }
              : {}),
          },
        },
      }),

      // --- удаляем старые связи ---
      ...(lessonsToDelete.length
        ? [
            this.prisma.moduleLesson.deleteMany({
              where: {
                moduleId: id,
                lessonId: { in: lessonsToDelete },
              },
            }),
          ]
        : []),

      // --- создаём новые связи ---
      ...(lessonsToCreate.length
        ? lessonsToCreate.map((lesson, index) =>
            this.prisma.moduleLesson.create({
              data: {
                moduleId: id,
                lessonId: lesson.id,
                order: lesson.order ?? index,
              },
            }),
          )
        : []),

      // --- обновляем порядок существующих уроков ---
      ...(lessonsToUpdate.length
        ? lessonsToUpdate.map((lesson, index) =>
            this.prisma.moduleLesson.update({
              where: {
                moduleId_lessonId: {
                  moduleId: id,
                  lessonId: lesson.id,
                },
              },
              data: {
                order: lesson.order ?? index,
              },
            }),
          )
        : []),
    ]);

    return this.prisma.module.findUnique({
      where: { id },
      include: {
        moduleLessons: {
          orderBy: { order: 'asc' },
          include: {
            lesson: true,
          },
        },
      },
    });
  }

  // ---------------- DELETE ----------------
  async deleteModule(id: number) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) throw new Error('Module not found');

    if (module?.publicImgId) {
      this.fileService.deleteFile(module.publicImgId, 'image');
    }

    await this.prisma.module.delete({ where: { id } });
  }

  // ---------------- LIST MODULES ----------------
  async getModules(params: { search?: string; categories?: string[] }) {
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
        : {}),
    };

    return this.prisma.module.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
      include: {
        lessons: { select: { id: true, title: true } },
        categories: { select: { id: true, title: true, color: true } },
      },
    });
  }

  // ---------------- GET MODULE WITH ACCESS ----------------
  async getModule(id: number, userId: number, role: string) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        moduleLessons: {
          orderBy: { order: 'asc' },
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                content: true,
                categories: true,
              },
            },
          },
        },
        categories: {
          select: { id: true, title: true, color: true },
        },
      },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    const lessons = module.moduleLessons.map((ml) => ml.lesson);
    const lessonIds = lessons.map((l) => l.id);

    // Получаем доступы студента по урокам
    const accesses = await this.prisma.userLessonAccess.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
      select: {
        lessonId: true,
        blocks: true,
      },
    });

    const accessMap = new Map<number, number[]>();
    accesses.forEach((a) => accessMap.set(a.lessonId, a.blocks));

    const lessonsWithAccess = lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      categories: lesson.categories,
      access:
        role === 'admin' ||
        role === 'super_admin' ||
        (accessMap.get(lesson.id)?.length ?? 0) > 0,
    }));

    return {
      id: module.id,
      title: module.title,
      categories: module.categories,
      lessons: lessonsWithAccess,
    };
  }
}
