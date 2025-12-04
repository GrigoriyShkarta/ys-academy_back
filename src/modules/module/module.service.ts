import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { ModuleDto } from './dto/module.dto';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  // ---------------- CREATE MODULE ----------------
  async createModule(data: ModuleDto) {
    const createdModule = await this.prisma.module.create({
      data: {
        title: data.title,
        url: data.url,
        categories: data.categories?.length
          ? {
              connect: data.categories.map((id) => ({ id: Number(id) })),
            }
          : undefined,
        lessons: data.lessons?.length
          ? {
              connect: data.lessons.map((l) => ({ id: l.id })),
            }
          : undefined,
      },
    });

    // Устанавливаем индексы
    if (data.lessons?.length) {
      await this.prisma.$transaction(
        data.lessons.map((l) =>
          this.prisma.lesson.update({
            where: { id: l.id },
            data: { index: l.index ?? null },
          }),
        ),
      );
    }

    return this.prisma.module.findUnique({
      where: { id: createdModule.id },
      include: { lessons: { orderBy: { index: 'asc' } } },
    });
  }

  // ---------------- UPDATE MODULE ----------------
  async updateModule(data: ModuleDto, id: number) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: { lessons: { select: { id: true } } },
    });

    if (!module) throw new Error('Module not found');

    // const currentIds = module.lessons.map((l) => l.id);
    const incomingIds = data.lessons?.map((l) => l.id) ?? [];

    // --- Обновляем базовые поля ---
    await this.prisma.module.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        url: data.url ?? undefined,
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
        lessons: {
          set: incomingIds.map((lessonId) => ({ id: lessonId })),
        },
      },
    });

    // --- Обновляем INDEX у уроков ---
    if (data.lessons?.length) {
      await this.prisma.$transaction(
        data.lessons.map((l) =>
          this.prisma.lesson.update({
            where: { id: l.id },
            data: { index: l.index ?? null },
          }),
        ),
      );
    }

    return this.prisma.module.findUnique({
      where: { id },
      include: { lessons: { orderBy: { index: 'asc' } } },
    });
  }

  // ---------------- DELETE ----------------
  async deleteModule(id: number) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) throw new Error('Module not found');

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
        lessons: true,
        categories: { select: { id: true, title: true, color: true } },
      },
    });
  }

  // ---------------- GET MODULE WITH ACCESS ----------------
  async getModule(id: number, userId: number, role: string) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { index: 'asc' } },
        categories: { select: { id: true, title: true, color: true } },
      },
    });

    if (!module) throw new Error('Module not found');

    const lessonIds = module.lessons.map((l) => l.id);

    const accesses = await this.prisma.userLessonAccess.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, blocks: true },
    });

    const accessMap = new Map<number, number[]>();
    accesses.forEach((a) => accessMap.set(a.lessonId, a.blocks));

    const lessonsWithAccess = module.lessons.map((l) => ({
      ...l,
      access:
        role === 'admin' ||
        role === 'super_admin' ||
        (accessMap.get(l.id)?.length ?? 0) > 0,
    }));

    return { ...module, lessons: lessonsWithAccess };
  }
}
