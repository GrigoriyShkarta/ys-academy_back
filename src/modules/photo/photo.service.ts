import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { LessonBlock } from '../../common/types/helpTypes';
import { cleanNodesArray } from '../../common/helpers';
import { Prisma } from 'generated/prisma';

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async uploadPhoto(
    file: Express.Multer.File,
    title: string,
    userId: number,
    categoryIds?: number[],
  ) {
    const uploaded = await this.fileService.uploadFile(file, 'image');
    await this.prisma.photo.create({
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

  async getAllAPhoto(
    page: number | 'all' = 1,
    search = '',
    categories?: string[],
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    // Считаем общее количество аудио с учетом поиска
    const totalCount = await this.prisma.photo.count({
      where: {
        title: {
          contains: search,
          mode: 'insensitive', // не учитываем регистр
        },
      },
    });

    const photos = await this.prisma.photo.findMany({
      where: {
        title: {
          contains: search,
          mode: 'insensitive',
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
      },
      select: {
        id: true,
        title: true,
        url: true,
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
      skip,
      take,
      orderBy: { createdAt: 'desc' }, // можно сортировать по дате
    });

    const totalPages = Math.ceil(totalCount / take);

    return {
      data: photos,
      meta: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  async updatePhoto(
    id: number,
    title: string,
    fileOrUrl?: Express.Multer.File | string,
    categoryIds?: string[],
  ) {
    const photo = await this.prisma.photo.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException('Photo not found');

    let updatedUrl = photo.url;
    let updatedPublicId = photo.publicId;

    if (fileOrUrl) {
      if (typeof fileOrUrl === 'string') {
        // Если пришла ссылка
        updatedUrl = fileOrUrl;
      } else if ('buffer' in fileOrUrl) {
        await this.fileService.deleteFile(photo.publicId, 'image');
        const uploaded = await this.fileService.uploadFile(fileOrUrl, 'image');
        updatedUrl = uploaded.url;
        updatedPublicId = uploaded.public_id;
      }
    }

    await this.prisma.photo.update({
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

  async deletePhoto(ids: number[]) {
    const photos = await this.prisma.photo.findMany({
      where: { id: { in: ids } },
    });

    if (!photos.length)
      throw new NotFoundException('No photo found for given IDs');

    for (const photo of photos) {
      if (photo.publicId) {
        try {
          await this.fileService.deleteFile(photo.publicId, 'image');
        } catch (e) {
          console.warn(`Не удалось удалить файл ${photo.publicId}:`, e);
        }
      }
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { photos: { some: { id: { in: ids } } } },
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

    // Удаляем записи из базы
    await this.prisma.photo.deleteMany({
      where: { id: { in: ids } },
    });

    return { success: true, deleted: ids.length };
  }
}
