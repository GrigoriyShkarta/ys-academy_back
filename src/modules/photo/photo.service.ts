import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async uploadPhoto(file: Express.Multer.File, title: string, userId: number) {
    const uploaded = await this.fileService.uploadFile(file, 'image');
    await this.prisma.photo.create({
      data: {
        title,
        url: uploaded.url,
        publicId: uploaded.public_id,
        userId,
      },
    });
    return true;
  }

  async getAllAPhoto(page: number | 'all' = 1, search = '') {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page) - 1) * take;

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
      },
      select: {
        id: true,
        title: true,
        url: true,
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

    // Удаляем записи из базы
    await this.prisma.photo.deleteMany({
      where: { id: { in: ids } },
    });

    return { success: true, deleted: ids.length };
  }
}
