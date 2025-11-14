import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateLessonDto,
  CreateLessonItemDto,
  LessonItemSource,
  LessonItemType,
} from './dto/create-lesson.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { UpdateLessonItemDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createLesson(dto: CreateLessonDto) {
    await this.prisma.lesson.create({
      data: {
        title: dto.title,
        content: dto.blocks || [],
      },
    });
    return { success: true };
  }

  async updateLesson(id: number, dto: CreateLessonDto) {
    const currentLesson = await this.prisma.lesson.findUnique({
      where: { id },
    });

    if (!currentLesson) throw new BadRequestException('Lesson not found');

    await this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.blocks || [],
      },
    });
  }

  async deleteLesson() {}

  private async getBankItemUrl(
    item: CreateLessonItemDto | UpdateLessonItemDto,
  ): Promise<string | undefined> {
    if (item.bankItemId) {
      switch (item.type) {
        case LessonItemType.VIDEO: {
          const video = await this.prisma.video.findUnique({
            where: { id: Number(item.bankItemId) },
          });
          if (!video) throw new BadRequestException('Video not found in bank');
          return video.url;
        }
        case LessonItemType.AUDIO: {
          const audio = await this.prisma.audio.findUnique({
            where: { id: Number(item.bankItemId) },
          });
          if (!audio) throw new BadRequestException('Audio not found in bank');
          return audio.url;
        }
        case LessonItemType.IMAGE: {
          const photo = await this.prisma.photo.findUnique({
            where: { id: Number(item.bankItemId) },
          });
          if (!photo) throw new BadRequestException('Photo not found in bank');
          return photo.url;
        }
        case LessonItemType.TEXT: {
          const text = await this.prisma.text.findUnique({
            where: { id: Number(item.bankItemId) },
          });
          if (!text) throw new BadRequestException('Text not found in bank');
          return text.content;
        }
      }
    }
    return item.content as string; // Возвращаем content из DTO, если bankItemId отсутствует
  }

  private async handleCustomSource(
    item: CreateLessonItemDto | UpdateLessonItemDto,
  ): Promise<{ publicId: string; content: string } | string> {
    if (item.type === LessonItemType.TEXT) {
      return (item.content as string) ?? '';
    }

    const fileType = item.type === LessonItemType.AUDIO ? 'video' : item.type;

    const uploadResult = await this.fileService.uploadFile(
      item.content as Express.Multer.File,
      fileType ?? 'image',
    );

    return {
      publicId: uploadResult.public_id,
      content: uploadResult.secure_url,
    };
  }

  private getBankRelationFields(
    item: CreateLessonItemDto | UpdateLessonItemDto,
  ) {
    if (item.source !== LessonItemSource.BANK || !item.bankItemId) return {};

    switch (item.type) {
      case LessonItemType.VIDEO:
        return { videoId: Number(item.bankItemId) };
      case LessonItemType.AUDIO:
        return { audioId: Number(item.bankItemId) };
      case LessonItemType.IMAGE:
        return { photoId: Number(item.bankItemId) };
      case LessonItemType.TEXT:
        return { textId: Number(item.bankItemId) };
      default:
        return {};
    }
  }

  async getUnassignedLessons(search = '') {
    return this.prisma.lesson.findMany({
      where: {
        title: {
          contains: search,
          mode: 'insensitive', // не учитываем регистр
        },
      },
      select: {
        id: true,
        title: true,
      },
    });
  }

  async getLesson(id: number) {
    return this.prisma.lesson.findUnique({
      where: { id },
    });
  }
}
