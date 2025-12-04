import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { Prisma } from 'generated/prisma';
import {
  LessonBlock,
  LessonNode,
  MediaRecord,
} from '../../common/types/helpTypes';
import {
  collectAudioIds,
  collectPhotoIds,
  collectVideoIds,
} from '../../common/helpers';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  private async resolveMediaLinksInContent(
    content: LessonBlock[],
  ): Promise<LessonBlock[]> {
    const audioIds = new Set<number>();
    const photoIds = new Set<number>();
    const videoIds = new Set<number>();

    const collect = (node: LessonNode): void => {
      if (!node || typeof node !== 'object') return;
      const type = node.type;
      const props = node.props ?? {};
      const raw = props['bankId'] ?? props['name'];

      let idNum: number | undefined;
      if (typeof raw === 'number') idNum = raw;
      else if (typeof raw === 'string' && raw.trim() !== '') {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) idNum = parsed;
      }

      if (typeof idNum === 'number') {
        if (type === 'audio') audioIds.add(idNum);
        if (type === 'image' || type === 'photo') photoIds.add(idNum);
        if (type === 'video' || type === 'youtube') videoIds.add(idNum);
      }

      const children = Array.isArray(node.children)
        ? node.children
        : Array.isArray(node.content)
          ? node.content
          : [];

      for (const c of children) collect(c);
    };

    for (const block of content) {
      const nodes = Array.isArray(block?.content) ? block.content : [];
      for (const n of nodes) collect(n);
    }

    const [audios, photos, videos] = await Promise.all([
      audioIds.size
        ? this.prisma.audio.findMany({
            where: { id: { in: Array.from(audioIds) } },
            select: { id: true, url: true, publicId: true, title: true },
          })
        : Promise.resolve([] as MediaRecord[]),
      photoIds.size
        ? this.prisma.photo.findMany({
            where: { id: { in: Array.from(photoIds) } },
            select: { id: true, url: true, publicId: true, title: true },
          })
        : Promise.resolve([] as MediaRecord[]),
      videoIds.size
        ? this.prisma.video.findMany({
            where: { id: { in: Array.from(videoIds) } },
            select: { id: true, url: true, publicId: true, title: true },
          })
        : Promise.resolve([] as MediaRecord[]),
    ]);

    const audioMap = new Map<number, MediaRecord>(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      audios.map((a) => [a.id, a] as [number, MediaRecord]),
    );
    const photoMap = new Map<number, MediaRecord>(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      photos.map((p) => [p.id, p] as [number, MediaRecord]),
    );
    const videoMap = new Map<number, MediaRecord>(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      videos.map((v) => [v.id, v] as [number, MediaRecord]),
    );

    const apply = (node: LessonNode): void => {
      if (!node || typeof node !== 'object') return;
      const type = node.type;
      const props = node.props ?? {};
      const raw = props['bankId'] ?? props['name'];

      let idNum: number | undefined;
      if (typeof raw === 'number') idNum = raw;
      else if (typeof raw === 'string' && raw.trim() !== '') {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) idNum = parsed;
      }

      if (typeof idNum === 'number') {
        if (type === 'audio' && audioMap.has(idNum)) {
          const rec = audioMap.get(idNum)!;
          const newProps = { ...(node.props ?? {}) } as Record<string, unknown>;
          newProps.url = rec.url;
          if (rec.publicId != null) newProps.publicId = rec.publicId;
          if (rec.title != null) newProps.name = rec.id;
          if (rec.bankId != null) newProps.bankId = rec.id;
          node.props = newProps;
        }

        if ((type === 'image' || type === 'photo') && photoMap.has(idNum)) {
          const rec = photoMap.get(idNum)!;
          const newProps = { ...(node.props ?? {}) } as Record<string, unknown>;
          newProps.url = rec.url;
          if (rec.publicId != null) newProps.publicId = rec.publicId;
          if (rec.title != null) newProps.name = rec.id;
          node.props = newProps;
        }

        if ((type === 'video' || type === 'youtube') && videoMap.has(idNum)) {
          const rec = videoMap.get(idNum)!;
          const newProps = { ...(node.props ?? {}) } as Record<string, unknown>;
          newProps.url = rec.url;
          if (rec.publicId != null) newProps.publicId = rec.publicId;
          if (rec.title != null) newProps.name = rec.id;
          node.props = newProps;
        }
      }

      const children = Array.isArray(node.children)
        ? node.children
        : Array.isArray(node.content)
          ? node.content
          : [];

      for (const c of children) apply(c);
    };

    const cloned = JSON.parse(JSON.stringify(content)) as LessonBlock[];
    for (const block of cloned) {
      const nodes = Array.isArray(block?.content) ? block.content : [];
      for (const n of nodes) apply(n);
    }

    return cloned;
  }

  private async syncLessonAudios(lessonId: number, audioIds: number[]) {
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        audios: {
          set: audioIds.map((id) => ({ id })),
        },
      },
    });
  }

  private async syncLessonPhotos(lessonId: number, photoIds: number[]) {
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        photos: {
          set: photoIds.map((id) => ({ id })),
        },
      },
    });
  }

  private async syncLessonVideos(lessonId: number, videoIds: number[]) {
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videos: {
          set: videoIds.map((id) => ({ id })),
        },
      },
    });
  }

  // Обновлённые createLesson / updateLesson внутри класса

  async createLesson(dto: CreateLessonDto) {
    const content = await this.resolveMediaLinksInContent(dto.blocks || []);

    const created = await this.prisma.lesson.create({
      data: {
        title: dto.title,
        cover: dto?.cover ?? '',
        content: (content as Prisma.JsonValue) || [],
        categories: dto?.categoryIds?.length
          ? {
              connect: dto.categoryIds.map((id) => ({ id: +id })),
            }
          : undefined,
        modules: dto.moduleIds?.length
          ? {
              connect: dto.moduleIds.map((id) => ({ id: +id })),
            }
          : undefined,
      },
    });

    const audioIds = collectAudioIds(dto.blocks || []);
    const photoIds = collectPhotoIds(dto.blocks || []);
    const videoIds = collectVideoIds(dto.blocks || []);

    await Promise.all([
      this.syncLessonAudios(created.id, audioIds),
      this.syncLessonPhotos(created.id, photoIds),
      this.syncLessonVideos(created.id, videoIds),
    ]);

    return { success: true, id: created.id };
  }

  async updateLesson(id: number, dto: CreateLessonDto) {
    const currentLesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!currentLesson) throw new BadRequestException('Lesson not found');

    const content = await this.resolveMediaLinksInContent(dto.blocks || []);

    await this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        cover: dto?.cover ?? '',
        content: (content as Prisma.JsonValue) || [],
        categories:
          dto?.categoryIds && dto.categoryIds.length > 0
            ? {
                set: [], // сначала отключаем ВСЕ старые связи
                connect: dto.categoryIds
                  .filter((id) => !isNaN(Number(id)))
                  .map((id) => ({ id: Number(id) })),
              }
            : {
                set: [], // если categoryIds пустой — отвязываем все категории
              },
        modules:
          dto?.moduleIds && dto.moduleIds.length > 0
            ? {
                set: [], // сначала отключаем ВСЕ старые связи
                connect: dto.moduleIds
                  .filter((id) => !isNaN(Number(id)))
                  .map((id) => ({ id: Number(id) })),
              }
            : {
                set: [], // если categoryIds пустой — отвязываем все категории
              },
      },
    });

    const audioIds = collectAudioIds(dto.blocks || []);
    const photoIds = collectPhotoIds(dto.blocks || []);
    const videoIds = collectVideoIds(dto.blocks || []);

    await Promise.all([
      this.syncLessonAudios(id, audioIds),
      this.syncLessonPhotos(id, photoIds),
      this.syncLessonVideos(id, videoIds),
    ]);

    return { success: true };
  }

  async deleteLesson(ids: number[]) {
    const formatedIds = ids.map((id) => +id);
    const lesson = await this.prisma.lesson.findMany({
      where: { id: { in: formatedIds } },
    });
    if (!lesson) throw new BadRequestException('Lesson not found');

    await this.prisma.lesson.deleteMany({ where: { id: { in: formatedIds } } });
    return { success: true };
  }

  async getAllLessons(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
    categories?: string[],
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    console.log('categories', categories);

    const where =
      search || categories
        ? {
            title: {
              contains: search,
              mode: 'insensitive' as const,
            },
            ...(Array.isArray(categories) && categories.length > 0
              ? {
                  categories: {
                    some: {
                      id: {
                        in: categories.map((id) => Number(id)),
                      },
                    },
                  },
                }
              : {}),
          }
        : {};

    console.log('where', where);

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
        categories: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
        modules: {
          select: {
            id: true,
            title: true,
          },
        },
        // добавляй другие поля по необходимости
      },
      ...(isAll ? {} : { skip, take }),
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
      select: {
        id: true,
        title: true,
        content: true,
        cover: true,
        categories: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
        modules: {
          select: {
            id: true,
            title: true,
          },
        },
      },
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
