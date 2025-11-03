import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleDto } from './dto/module.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createModule(dto: ModuleDto, file?: Express.Multer.File) {
    // нормализуем список id (FormData может прислать строки)
    const lessonsId = (dto.lessonsId || []).map((id) => +id).filter(Boolean);
    const lessonsIndex = (dto.lessonsIndex || []).map(Number);

    // подготовим данные для создания
    const data = {
      title: dto.title,
      publicImgId: '',
      url: '',
      lessons: {
        connect: lessonsId.map((id) => ({ id })),
      },
    };

    // если пришёл файл — заливаем в Cloudinary
    if (file) {
      const uploadResult = await this.fileService.uploadFile(file, 'image');
      data.publicImgId = uploadResult.public_id;
      data.url = uploadResult.secure_url;
    } else if (dto.url) {
      // если в DTO прислали строку (url), сохраняем её как imgUrl
      // поле name в DTO — imageId, поэтому считаем это ссылкой
      data.url = dto.url;
    }

    // находим существующие уроки и подключаем их
    const existingLessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonsId } },
      select: { id: true },
    });

    if (existingLessons.length) {
      data.lessons = {
        connect: existingLessons.map((l) => ({ id: l.id })),
      };
    }

    await this.prisma.module.create({ data });

    if (lessonsId.length > 0) {
      const updatePromises = lessonsId.map((lessonId, i) => {
        const index = lessonsIndex[i] ?? i; // fallback: порядок в массиве
        return this.prisma.lesson.update({
          where: { id: lessonId },
          data: { index },
        });
      });

      await Promise.all(updatePromises);
    }
    return { success: true };
  }

  async updateModule(
    id: number,
    dto: ModuleDto,
    file?: Express.Multer.File,
  ): Promise<{ success: true }> {
    const lessonsId = (dto.lessonsId || [])
      .map((v) => Number(v))
      .filter(Boolean);

    const lessonsIndex = (dto.lessonsIndex || []).map(Number);

    const existing = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        publicImgId: true,
        url: true,
        lessons: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    const data = {
      title: dto.title,
      publicImgId: '',
      url: '',
      lessons: {
        set: lessonsId.map((id) => ({ id })), // Заменяем connect на set
      },
    };

    // Обработка файла / строки
    if (file) {
      if (existing.publicImgId) {
        await this.fileService
          .deleteFile(existing.publicImgId, 'image')
          .catch(() => null);
      }
      const uploadResult = await this.fileService.uploadFile(file, 'image');
      data.publicImgId = uploadResult.public_id;
      data.url = uploadResult.secure_url;
    } else if (dto.url) {
      if (existing.publicImgId) {
        await this.fileService
          .deleteFile(existing.publicImgId, 'image')
          .catch(() => null);
      }
      // Сбрасываем publicImgId и ставим новую ссылку
      data.publicImgId = '';
      data.url = dto.url;
    } else {
      // Если ни файла, ни ссылки — удаляем старый (если был) и очищаем поля
      if (existing.publicImgId) {
        await this.fileService
          .deleteFile(existing.publicImgId, 'image')
          .catch(() => null);
      }
      data.publicImgId = '';
      data.url = '';
    }

    await this.prisma.module.update({
      where: { id },
      data,
    });

    if (lessonsId.length > 0) {
      const updatePromises = lessonsId.map((lessonId, index) => {
        const newIndex = lessonsIndex[index] ?? index; // fallback на порядок в массиве
        return this.prisma.lesson.updateMany({
          where: {
            id: lessonId,
            moduleId: id, // важно: только уроки этого модуля
          },
          data: {
            index: newIndex,
          },
        });
      });

      await Promise.all(updatePromises);
    }

    return { success: true };
  }

  deleteModule = async (id: number) => {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        publicImgId: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    if (module.publicImgId) {
      await this.fileService
        .deleteFile(module.publicImgId, 'image')
        .catch(() => null);
    }

    await this.prisma.module.delete({ where: { id } });
    return { success: true };
  };

  async getModules(search = '') {
    return this.prisma.module.findMany({
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
        lessons: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async getModule(id: number) {
    return this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        url: true,
        lessons: {
          select: {
            id: true,
            title: true,
            index: true,
          },
          orderBy: {
            index: 'asc',
          },
        },
      },
    });
  }
}
