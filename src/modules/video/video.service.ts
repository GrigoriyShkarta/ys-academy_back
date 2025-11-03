import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class VideoService {
  constructor(private prisma: PrismaService) {}

  async uploadVideo(videoUrl: string, title: string, userId: number) {
    await this.prisma.video.create({
      data: {
        title,
        url: videoUrl,
        userId,
      },
    });

    return true;
  }

  async getAllVideo(page: number | 'all' = 1, search = '') {
    const take = 12;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page) - 1) * take;

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
    await this.prisma.video.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
