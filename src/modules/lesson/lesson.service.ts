import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { Prisma } from 'generated/prisma';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createLesson(dto: CreateLessonDto) {
    await this.prisma.lesson.create({
      data: {
        title: dto.title,
        cover: dto?.cover ?? '',
        content: dto.blocks || [],
      },
    });
    return { success: true };
  }

  async updateLesson(id: number, dto: CreateLessonDto) {
    const currentLesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!currentLesson) throw new BadRequestException('Lesson not found');

    await this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        cover: dto?.cover ?? '',
        content: dto.blocks || [],
      },
    });
  }

  async deleteLesson(ids: number[]) {
    const lesson = await this.prisma.lesson.findMany({
      where: { id: { in: ids } },
    });
    if (!lesson) throw new BadRequestException('Lesson not found');

    await this.prisma.lesson.deleteMany({ where: { id: { in: ids } } });
    return { success: true };
  }

  async getAllLessons(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    const where = search
      ? {
          title: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {};

    const totalCount = await this.prisma.lesson.count({ where });

    const allowedFields = ['id', 'title', 'createdAt'] as const;
    const orderField =
      sortBy && allowedFields.includes(sortBy as any) ? sortBy : 'createdAt';

    const lessons = await this.prisma.lesson.findMany({
      where,
      orderBy: {
        [orderField]: sortOrder,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        // добавляй другие поля по необходимости
      },
      skip,
      take,
    });

    const totalPages = isAll ? 1 : Math.ceil(totalCount / take);

    return {
      data: lessons,
      meta: {
        currentPage: isAll ? 'all' : Number(page),
        totalPages,
        totalItems: totalCount,
        hasNextPage: isAll ? false : Number(page) < totalPages,
        hasPrevPage: isAll ? false : Number(page) > 1,
      },
    };
  }

  async getLessonsWithStudentsAccept(search = '') {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    });

    const students = await this.prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true },
    });

    const lessonIds = lessons.map((l) => l.id);
    const studentIds = students.map((s) => s.id);

    // если нет уроков — просто возвращаем пустой accept для каждого урока
    if (!lessonIds.length) {
      return lessons.map((l) => ({ ...l, accept: [] as number[] }));
    }

    // если нет студентов — у всех уроков accept = []
    if (!studentIds.length) {
      return lessons.map((l) => ({ ...l, accept: [] as number[] }));
    }

    const accesses = await this.prisma.userLessonAccess.findMany({
      where: { lessonId: { in: lessonIds }, userId: { in: studentIds } },
      select: { lessonId: true, userId: true },
    });

    const lessonAcceptMap = new Map<number, Set<number>>();
    for (const id of lessonIds) lessonAcceptMap.set(id, new Set<number>());

    for (const a of accesses) {
      const set = lessonAcceptMap.get(a.lessonId) ?? new Set<number>();
      set.add(a.userId);
      lessonAcceptMap.set(a.lessonId, set);
    }

    return lessons.map((l) => ({
      id: l.id,
      title: l.title,
      accept: Array.from(lessonAcceptMap.get(l.id) || []),
    }));
  }

  async getLesson(id: number) {
    return this.prisma.lesson.findUnique({
      where: { id },
    });
  }

  async grantLessonsAccess(
    studentIds: number[],
    lessons: { id: number; blocks?: number[] }[],
  ) {
    // проверяем пользователей
    const users = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    if (users.length !== studentIds.length)
      throw new BadRequestException('Some users not found');

    // подгружаем уроки и нормализуем content в { blockId: number }[]
    const lessonIds = lessons.map((l) => +l.id);
    const lessonRecords = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { id: true, content: true },
    });

    const lessonMap = new Map<number, { blockId: number }[]>();
    for (const lr of lessonRecords) {
      const raw = Array.isArray(lr.content) ? lr.content : [];
      const normalized = (raw as Prisma.JsonValue[])
        .filter(
          (it): it is Prisma.JsonObject =>
            it !== null && typeof it === 'object' && !Array.isArray(it),
        )
        .map((obj) => {
          const bid = obj['blockId'];
          let n = NaN;
          if (typeof bid === 'number') {
            n = bid;
          } else if (typeof bid === 'string' && bid.trim() !== '') {
            const parsed = Number(bid);
            if (!Number.isNaN(parsed)) n = parsed;
          }
          return Number.isFinite(n) ? { blockId: n } : null;
        })
        .filter((x): x is { blockId: number } => x !== null);

      lessonMap.set(lr.id, normalized);
    }

    // собираем записи для createMany
    const data: Prisma.UserLessonAccessCreateManyInput[] = [];

    for (const u of users) {
      for (const payload of lessons) {
        const lessonContent = lessonMap.get(+payload.id);
        if (!lessonContent) continue; // урок не найден — пропускаем

        const availableBlockIds = lessonContent.map((b) => +b.blockId);
        let blocksToStore: number[] = [];
        if (payload.blocks && payload.blocks.length) {
          const valid = Array.from(
            new Set(
              payload.blocks
                .map((b) => Number(b))
                .filter((b) => availableBlockIds.includes(b)),
            ),
          );
          if (!valid.length) continue; // нет валидных блоков — пропускаем
          blocksToStore = valid;
        } else {
          // нет переданных blockIds — даём доступ ко всему уроку:
          // сохраняем в базу все id блоков урока
          blocksToStore = [...availableBlockIds];
        }

        data.push({
          userId: u.id,
          lessonId: +payload.id,
          blocks: blocksToStore,
        } as Prisma.UserLessonAccessCreateManyInput);
      }
    }

    // удаляем текущие доступы у указанных студентов
    // только для уроков, которые передаются в payload (lessonIds)
    if (lessonIds.length) {
      await this.prisma.userLessonAccess.deleteMany({
        where: {
          userId: { in: studentIds },
          lessonId: { in: lessonIds },
        },
      });
    }

    if (data.length) {
      await this.prisma.userLessonAccess.createMany({
        data,
        skipDuplicates: true,
      });
    }

    return { success: true, granted: data.length };
  }
}
