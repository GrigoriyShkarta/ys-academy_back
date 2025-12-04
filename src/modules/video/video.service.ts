import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { LessonBlock } from '../../common/types/helpTypes';
import { cleanNodesArray } from '../../common/helpers';
import { Prisma } from 'generated/prisma';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async uploadVideo(
    title: string,
    userId: number,
    file?: Express.Multer.File,
    videoUrl?: string,
    categoryIds?: number[],
  ): Promise<boolean> {
    let uploaded: { url: string; public_id: string } | null = null;

    if (file) {
      uploaded = await this.fileService.uploadFile(file, 'video');
    }

    if (!videoUrl && !uploaded?.url) {
      throw new BadRequestException(
        'Either video file or URL must be provided',
      );
    }

    await this.prisma.video.create({
      data: {
        title,
        url: videoUrl || uploaded!.url,
        publicId: uploaded?.public_id || null,
        userId,
        categories: categoryIds?.length
          ? {
              connect: categoryIds.map((id) => ({ id: +id })),
            }
          : undefined,
      },
    });

    return true;
  }

  async getAllVideo(
    page: number | 'all' = 1,
    search = '',
    categories?: string[],
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    const totalCount = await this.prisma.video.count({
      where: {
        title: {
          contains: search,
          mode: 'insensitive', // не учитываем регистр
        },
      },
    });

    const videos = await this.prisma.video.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    const totalPages = Math.ceil(totalCount / take);

    return {
      data: videos,
      meta: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  async updateVideo(
    id: number,
    title: string,
    videoUrl: string,
    categoryIds?: string[],
  ) {
    await this.prisma.video.update({
      where: { id },
      data: {
        title,
        url: videoUrl,
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
  }

  async deleteVideo(ids: number[]) {
    const videos = await this.prisma.video.findMany({
      where: { id: { in: ids } },
      select: { id: true, url: true, publicId: true },
    });

    for (const v of videos) {
      if (v?.publicId) {
        try {
          await this.fileService.deleteFile(v.publicId, 'video');
        } catch (e) {
          console.error(`Error deleting file ${v.publicId}:`, e);
        }
      }
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { videos: { some: { id: { in: ids } } } },
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

    await this.prisma.video.deleteMany({ where: { id: { in: ids } } });
  }
}
