import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { ModuleDto } from './dto/module.dto';
import { Prisma } from 'generated/prisma';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createModule(data: ModuleDto) {
    // 1) Создаём модуль без вложенных lessons
    const createdModule = await this.prisma.module.create({
      data: {
        title: data.title,
        url: data.url,
      },
    });

    // 2) Если есть уроки — обновляем каждый: ставим moduleId и index
    if (data.lessons && data.lessons.length) {
      const updates = data.lessons.map((l) =>
        this.prisma.lesson.update({
          where: { id: l.id },
          data: {
            moduleId: createdModule.id,
            index: l.index ?? undefined,
          },
        }),
      );
      await this.prisma.$transaction(updates);
    }

    // 3) Возвращаем модуль с уроками, отсортированными по index
    return this.prisma.module.findUnique({
      where: { id: createdModule.id },
      include: { lessons: { orderBy: { index: 'asc' } } },
    });
  }

  // typescript
  async updateModule(data: ModuleDto, id: number) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) throw new Error('Module not found');

    // Обновляем базовые поля модуля
    await this.prisma.module.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        url: data.url ?? undefined,
      },
    });

    // Если lessons не переданы — ничего с ними не делаем
    if (data.lessons === undefined) {
      return this.prisma.module.findUnique({
        where: { id },
        include: { lessons: { orderBy: { index: 'asc' } } },
      });
    }

    // Получаем текущие уроки модуля
    const currentLessons = await this.prisma.lesson.findMany({
      where: { moduleId: id },
      select: { id: true },
    });
    const currentIds = currentLessons.map((l) => l.id);
    const incomingIds = data.lessons.map((l) => l.id);

    // Уроки, которые нужно отвязать
    const toUnassign = currentIds.filter((cid) => !incomingIds.includes(cid));

    // Операции: привязать/обновить входящие уроки
    const ops: Prisma.PrismaPromise<any>[] = data.lessons.map((l) =>
      this.prisma.lesson.update({
        where: { id: l.id },
        data: {
          moduleId: id,
          index: l.index ?? undefined,
        },
      }),
    );

    // Если есть уроки для отвязки — добавляем updateMany
    if (toUnassign.length) {
      ops.push(
        this.prisma.lesson.updateMany({
          where: { id: { in: toUnassign } },
          data: { moduleId: null, index: null },
        }),
      );
    }

    if (ops.length) await this.prisma.$transaction(ops);

    return this.prisma.module.findUnique({
      where: { id },
      include: { lessons: { orderBy: { index: 'asc' } } },
    });
  }

  async deleteModule(id: number) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) throw new Error('Module not found');

    await this.prisma.module.delete({ where: { id } });
  }

  async getModules(params: { search: string }) {
    const { search } = params;

    const where: Prisma.ModuleWhereInput = {
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    return this.prisma.module.findMany({
      where,
      include: { lessons: true },
    });
  }

  async getModule(id: number) {
    return this.prisma.module.findUnique({
      where: { id },
      include: { lessons: true },
    });
  }
}
