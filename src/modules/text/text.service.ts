import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TextService {
  constructor(private prisma: PrismaService) {}

  async uploadText(content: string, title: string, userId: number) {
    await this.prisma.text.create({
      data: {
        title,
        content,
        userId,
      },
    });

    return true;
  }

  async getAllText(page: number | 'all' = 1, search = '') {
    const take = 12;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page) - 1) * take;

    const totalCount = await this.prisma.text.count({
      where: {
        title: {
          contains: search,
          mode: 'insensitive', // не учитываем регистр
        },
      },
    });

    const texts = await this.prisma.text.findMany({
      where: {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    const totalPages = Math.ceil(totalCount / take);

    return {
      data: texts,
      meta: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  async updateText(id: number, title: string, content: string) {
    await this.prisma.text.update({
      where: { id },
      data: {
        title,
        content,
      },
    });
  }

  async deleteText(ids: number[]) {
    await this.prisma.text.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
