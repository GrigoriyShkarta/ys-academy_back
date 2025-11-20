import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

@Injectable()
export class AudioService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async uploadAudio(file: Express.Multer.File, title: string, userId: number) {
    const uploaded = await this.fileService.uploadFile(file, 'video');
    await this.prisma.audio.create({
      data: {
        title,
        url: uploaded.url,
        publicId: uploaded.public_id,
        userId,
      },
    });
    return true;
  }

  async getAllAudio(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{
    data: { id: number; title: string; url: string; createdAt: Date }[];
    meta: {
      currentPage: number | 'all';
      totalPages: number;
      totalItems: number;
    };
  }> {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    const where = {
      title: {
        contains: search,
        mode: 'insensitive' as const,
      },
    };

    const totalCount = await this.prisma.audio.count({ where });

    // безопасная валидация полей сортировки
    const allowedFields = new Set(['id', 'title', 'createdAt']);
    const orderField =
      sortBy && allowedFields.has(sortBy)
        ? (sortBy as keyof typeof allowedFields)
        : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const audios = await this.prisma.audio.findMany({
      where,
      select: { id: true, title: true, url: true, createdAt: true },
      ...(isAll ? {} : { skip, take }),
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

    for (const audio of audios) {
      if (audio.publicId) {
        try {
          await this.fileService.deleteFile(audio.publicId, 'video');
        } catch (e) {
          console.warn(`Не удалось удалить файл ${audio.publicId}:`, e);
        }
      }
    }

    // Удаляем записи из базы
    await this.prisma.audio.deleteMany({
      where: { id: { in: ids } },
    });

    return { success: true, deleted: ids.length };
  }
}
