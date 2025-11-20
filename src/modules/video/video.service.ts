import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

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
      },
    });

    return true;
  }

  async getAllVideo(page: number | 'all' = 1, search = '') {
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
      },
      select: {
        id: true,
        title: true,
        url: true,
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

  async updateVideo(id: number, title: string, videoUrl: string) {
    await this.prisma.video.update({
      where: { id },
      data: {
        title,
        url: videoUrl,
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

    await this.prisma.video.deleteMany({ where: { id: { in: ids } } });
  }
}
