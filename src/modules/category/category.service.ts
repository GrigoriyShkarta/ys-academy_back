import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: { title: string; color?: string }[],
  ): Promise<{ id: number; title: string; color?: string | null }[]> {
    const cleaned = data
      .map((item) => ({
        title: item.title?.trim(),
        color: item.color?.trim() || null,
      }))
      .filter((item) => !!item.title && item.title.length > 0);

    if (cleaned.length === 0) return [];

    return this.prisma.$transaction(
      cleaned.map((item) =>
        this.prisma.category.upsert({
          where: { title: item.title },
          update: { color: item.color }, // обновляем цвет, если категория уже была
          create: { title: item.title, color: item.color },
          select: { id: true, title: true, color: true },
        }),
      ),
    );
  }

  async update(
    id: number,
    data: { title: string; color?: string },
  ): Promise<boolean> {
    const title = data.title?.trim();
    const color = data.color?.trim() || undefined;

    // Нечего обновлять
    if (!title && color === undefined) {
      return false;
    }

    // Пустой title недопустим
    if (title !== undefined && title.length === 0) {
      return false;
    }

    // Проверка на дубликат title в другой записи
    if (title) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          title,
          id: { not: id },
        },
      });
      if (duplicate) {
        return false;
      }
    }

    try {
      await this.prisma.category.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(color !== undefined ? { color } : {}),
        },
      });
      return true;
    } catch (e) {
      console.log('error', e);
      // запись не найдена или другая ошибка
      return false;
    }
  }

  async getAll(
    page: number | 'all' = 1,
    search = '',
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    const where = {
      title: {
        contains: search,
        mode: 'insensitive' as const,
      },
    };

    const totalCount = await this.prisma.category.count({ where });

    // безопасная валидация полей сортировки
    const allowedFields = new Set(['id', 'title', 'createdAt']);
    const orderField =
      sortBy && allowedFields.has(sortBy)
        ? (sortBy as keyof typeof allowedFields)
        : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const category = await this.prisma.category.findMany({
      where,
      select: { id: true, title: true, color: true, createdAt: true },
      ...(isAll ? {} : { skip, take }),
      orderBy: { [orderField]: order },
    });

    const totalPages = isAll ? 1 : Math.ceil(totalCount / take);

    return {
      data: category,
      meta: {
        currentPage: isAll ? 'all' : page,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  deleteMany = async (ids: number[]) => {
    await this.prisma.category.deleteMany({ where: { id: { in: ids } } });
  };
}
