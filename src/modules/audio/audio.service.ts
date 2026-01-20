import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { LessonBlock } from '../../common/types/helpTypes';
import { Prisma } from 'generated/prisma';
import { cleanNodesArray } from '../../common/helpers';

@Injectable()
export class AudioService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async uploadAudio(
    file: Express.Multer.File,
    title: string,
    userId: number,
    categoryIds?: number[],
  ) {
    const uploaded = await this.fileService.uploadFile(file, 'video');
    await this.prisma.audio.create({
      data: {
        title,
        url: uploaded.url,
        publicId: uploaded.public_id,
        userId,
        categories: categoryIds?.length
          ? {
              connect: categoryIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });
    return true;
  }

  async getAllAudio(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
    categories?: string[],
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
    };

    const totalCount = await this.prisma.audio.count({ where });

    // Безопасная валидация полей сортировки
    const allowedFields = new Set(['id', 'title', 'createdAt']);
    const orderField =
      sortBy && allowedFields.has(sortBy)
        ? (sortBy as keyof typeof allowedFields)
        : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const audios = await this.prisma.audio.findMany({
      where,
      select: {
        id: true,
        title: true,
        url: true,
        createdAt: true,
        lessons: {
          select: {
            id: true,
            title: true,
          },
        },
        categories: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
      },
      skip: isAll ? undefined : skip, // ⬅️ Более явно
      take: isAll ? undefined : take, // ⬅️ Более явно
      orderBy: { [orderField]: order },
    });

    const totalPages = isAll ? 1 : Math.ceil(totalCount / take);

    return {
      data: audios,
      meta: {
        currentPage: isAll ? 'all' : page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  async updateAudio(
    id: number,
    title: string,
    fileOrUrl?: Express.Multer.File | string,
    categoryIds?: string[],
  ) {
    const audio = await this.prisma.audio.findUnique({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');

    let updatedUrl = audio.url;
    let updatedPublicId = audio.publicId;

    if (fileOrUrl) {
      if (typeof fileOrUrl === 'string') {
        // Если пришла ссылка
        updatedUrl = fileOrUrl;
      } else if ('buffer' in fileOrUrl) {
        // Если пришёл новый файл
        await this.fileService.deleteFile(audio.publicId, 'video');
        const uploaded = await this.fileService.uploadFile(fileOrUrl, 'video');
        updatedUrl = uploaded.url;
        updatedPublicId = uploaded.public_id;
      }
    }

    await this.prisma.audio.update({
      where: { id },
      data: {
        title,
        url: updatedUrl,
        publicId: updatedPublicId,
        categories:
          categoryIds && categoryIds.length > 0
            ? {
                set: [], // сначала отключаем ВСЕ старые связи
                connect: categoryIds
                  .filter((id) => !isNaN(Number(id)))
                  .map((id) => ({ id: Number(id) })),
              }
            : {
                set: [], // если categoryIds пустой — отвязываем все категории
              },
      },
    });

    return { success: true };
  }

  async deleteAudio(ids: number[]) {
    const audios = await this.prisma.audio.findMany({
      where: { id: { in: ids } },
    });

    if (!audios.length)
      throw new NotFoundException('No audio found for given IDs');

    // Удаляем файлы в облаке (если есть)
    for (const audio of audios) {
      if (audio.publicId) {
        try {
          await this.fileService.deleteFile(audio.publicId, 'video');
        } catch (e) {
          console.warn(`Не удалось удалить файл ${audio.publicId}:`, e);
        }
      }
    }

    // Находим уроки, где используются эти аудио (по связи many-to-many)
    const lessons = await this.prisma.lesson.findMany({
      where: { audios: { some: { id: { in: ids } } } },
      select: { id: true, content: true },
    });

    const idSet = new Set<number>(ids);

    for (const lesson of lessons) {
      const content = lesson.content;
      if (!Array.isArray(content)) continue;

      const cloned = JSON.parse(JSON.stringify(content)) as LessonBlock[];

      for (const block of cloned) {
        // Очищаем верхний уровень блока (если есть)
        if (Array.isArray(block.content)) {
          block.content = cleanNodesArray(block.content, idSet);
        }
        // Также может быть вложённое поле children внутри блока — на всякий случай
        if (Array.isArray(block.children)) {
          block.children = cleanNodesArray(block.children, idSet);
        }
      }

      await this.prisma.lesson.update({
        where: { id: lesson.id },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        data: { content: cloned as unknown as Prisma.JsonValue },
      });
    }

    // Удаляем записи аудио из БД
    await this.prisma.audio.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      success: true,
    };
  }
}
