import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateLessonDto,
  CreateLessonItemDto,
  LessonItemSource,
  LessonItemType,
} from './dto/create-lesson.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';
import { UpdateLessonDto, UpdateLessonItemDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createLesson(dto: CreateLessonDto) {
    const { title, blocks } = dto;

    const lesson = await this.prisma.lesson.create({
      data: { title },
    });

    for (const block of blocks || []) {
      const createdBlock = await this.prisma.lessonBlock.create({
        data: {
          index: Number(block.index) || 0,
          lessonBlockId: lesson.id,
          title: block.title || '',
        },
      });

      for (const item of block.items || []) {
        let contentResult:
          | string
          | { publicId: string; content: string }
          | null = null;

        if (item.source === LessonItemSource.BANK) {
          contentResult =
            (await this.getBankItemUrl(item)) ??
            (typeof item.content === 'string' ? item.content : '') ??
            '';
        } else if (item.source === LessonItemSource.CUSTOM) {
          contentResult = await this.handleCustomSource(item);
        }

        let isUpload = false;
        let contentValue = '';

        // Determine the content value and publicId to store in the database
        if (typeof contentResult === 'object' && contentResult !== null) {
          contentValue = contentResult.content;
          isUpload = true;
        } else {
          contentValue = contentResult ?? '';
        }

        const audioPublicId =
          item.source === LessonItemSource.CUSTOM &&
          item.type === LessonItemType.AUDIO &&
          typeof contentResult === 'object' &&
          contentResult !== null
            ? contentResult.publicId
            : null;

        const photoPublicId =
          item.source === LessonItemSource.CUSTOM &&
          item.type === LessonItemType.IMAGE &&
          typeof contentResult === 'object' &&
          contentResult !== null
            ? contentResult.publicId
            : null;

        const videoPublicId =
          item.source === LessonItemSource.CUSTOM &&
          item.type === LessonItemType.VIDEO &&
          typeof contentResult === 'object' &&
          contentResult !== null
            ? contentResult.publicId
            : null;

        await this.prisma.lessonItem.create({
          data: {
            type: item.type,
            source: isUpload ? 'uploaded' : item.source,
            layout: item.layout ?? {},
            orderIndex: Number(item.orderIndex) || 0,
            content: contentValue,
            audioPublicId,
            photoPublicId,
            videoPublicId,
            lessonId: createdBlock.id,
            ...this.getBankRelationFields(item),
          },
        });
      }
    }

    return lesson;
  }

  async updateLesson(id: number, dto: UpdateLessonDto) {
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        blocks: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingLesson) {
      throw new BadRequestException('Lesson not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      // Обновляем заголовок урока
      await prisma.lesson.update({
        where: { id },
        data: {
          title: dto.title,
          updatedAt: new Date(),
        },
      });

      // Получаем существующие блоки
      const dtoBlockIndices = new Set(
        dto.blocks && dto.blocks.map((b) => b.index),
      );

      // Удаляем блоки, которых нет в DTO
      for (const block of existingLesson.blocks) {
        if (!dtoBlockIndices.has(block.index)) {
          await prisma.lessonItem.deleteMany({ where: { lessonId: block.id } });
          await prisma.lessonBlock.delete({ where: { id: block.id } });
        }
      }

      // Обрабатываем блоки из DTO
      for (const blockDto of dto.blocks || []) {
        let block = await prisma.lessonBlock.findFirst({
          where: { lessonBlockId: id, index: Number(blockDto.index) },
        });

        if (block) {
          // Обновляем существующий блок
          await prisma.lessonBlock.update({
            where: { id: block.id },
            data: { title: blockDto.title || '' },
          });
        } else {
          // Создаем новый блок
          block = await prisma.lessonBlock.create({
            data: {
              index: Number(blockDto.index) || 0,
              lessonBlockId: id,
              title: blockDto.title || '',
            },
          });
        }

        // Получаем существующие элементы блока
        const existingItems = await prisma.lessonItem.findMany({
          where: { lessonId: block.id },
        });

        const dtoItemIds = new Set<string>(
          (blockDto.items || [])
            .map((it) => (it.id != null ? String(it.id) : undefined))
            .filter((id): id is string => typeof id === 'string'),
        );

        // Удаляем элементы, которых нет в DTO
        for (const exItem of existingItems) {
          if (!dtoItemIds.has(String(exItem.id))) {
            const exItemSource = exItem.source as LessonItemSource;
            const exItemType = exItem.type as LessonItemType;
            if (
              (exItemSource === LessonItemSource.CUSTOM ||
                exItemSource === LessonItemSource.UPLOADED) &&
              exItemType !== LessonItemType.TEXT &&
              exItem.content
            ) {
              try {
                if (
                  exItemType === LessonItemType.AUDIO &&
                  exItem.audioPublicId
                ) {
                  await this.fileService.deleteFile(
                    exItem.audioPublicId,
                    'video',
                  );
                }
                if (
                  exItemType === LessonItemType.VIDEO &&
                  exItem.videoPublicId
                ) {
                  await this.fileService.deleteFile(
                    exItem.videoPublicId,
                    'video',
                  );
                }
                if (
                  exItemType === LessonItemType.IMAGE &&
                  exItem.photoPublicId
                ) {
                  await this.fileService.deleteFile(
                    exItem.photoPublicId,
                    'image',
                  );
                }
              } catch (e) {
                console.warn(`Failed to delete file for item ${exItem.id}:`, e);
              }
            }
            await prisma.lessonItem.delete({ where: { id: exItem.id } });
          }
        }

        // Обрабатываем элементы из DTO
        for (const itemDto of blockDto.items || []) {
          let contentResult:
            | string
            | { publicId: string; content: string }
            | undefined;
          let source = itemDto.source || 'uploaded'; // Устанавливаем значение по умолчанию

          if (itemDto.source === LessonItemSource.BANK) {
            contentResult = await this.getBankItemUrl(itemDto);
          } else if (itemDto.source === LessonItemSource.CUSTOM) {
            if (itemDto.type === LessonItemType.TEXT) {
              contentResult = (itemDto.content as string) ?? '';
            } else if (itemDto.content) {
              contentResult = await this.handleCustomSource(itemDto);
              source = LessonItemSource.UPLOADED; // Меняем source на 'uploaded' после успешной загрузки
            } else {
              throw new BadRequestException(
                `Content is required for custom ${itemDto.type} item`,
              );
            }
          } else if (
            itemDto.source === LessonItemSource.UPLOADED ||
            !itemDto.source
          ) {
            contentResult = (itemDto.content as string) ?? '';
          } else {
            throw new BadRequestException(`Invalid source`);
          }

          const contentValue =
            typeof contentResult === 'object' && contentResult !== null
              ? contentResult.content
              : (contentResult ?? '');

          const audioPublicIdCandidate =
            itemDto.source === LessonItemSource.CUSTOM &&
            itemDto.type === LessonItemType.AUDIO &&
            typeof contentResult === 'object' &&
            contentResult !== null
              ? contentResult.publicId
              : null;

          const photoPublicIdCandidate =
            itemDto.source === LessonItemSource.CUSTOM &&
            itemDto.type === LessonItemType.IMAGE &&
            typeof contentResult === 'object' &&
            contentResult !== null
              ? contentResult.publicId
              : null;

          const videoPublicIdCandidate =
            itemDto.source === LessonItemSource.CUSTOM &&
            itemDto.type === LessonItemType.VIDEO &&
            typeof contentResult === 'object' &&
            contentResult !== null
              ? contentResult.publicId
              : null;

          const existingItem =
            typeof itemDto.id !== 'undefined'
              ? existingItems.find((e) => String(e.id) === String(itemDto.id))
              : undefined;

          const audioPublicId =
            audioPublicIdCandidate ??
            (existingItem ? existingItem.audioPublicId : null);
          const photoPublicId =
            photoPublicIdCandidate ??
            (existingItem ? existingItem.photoPublicId : null);
          const videoPublicId =
            videoPublicIdCandidate ??
            (existingItem ? existingItem.videoPublicId : null);

          if (existingItem && typeof itemDto.id !== 'undefined') {
            // Обновляем существующий элемент
            await prisma.lessonItem.update({
              where: { id: existingItem.id },
              data: {
                type: itemDto.type,
                source, // Используем source, который может быть 'uploaded' для кастомных элементов
                orderIndex: Number(itemDto.orderIndex) || 0,
                layout: itemDto.layout ?? {},
                content: contentValue,
                audioPublicId,
                photoPublicId,
                videoPublicId,
                ...this.getBankRelationFields(itemDto),
              },
            });
          } else {
            // Создаем новый элемент
            await prisma.lessonItem.create({
              data: {
                type: itemDto.type,
                source, // Используем source, который может быть 'uploaded' для кастомных элементов
                orderIndex: Number(itemDto.orderIndex) || 0,
                layout: itemDto.layout ?? {},
                content: contentValue,
                audioPublicId: audioPublicIdCandidate,
                photoPublicId: photoPublicIdCandidate,
                videoPublicId: videoPublicIdCandidate,
                lessonId: block.id,
                ...this.getBankRelationFields(itemDto),
              },
            });
          }
        }
      }

      return await this.getLesson(id);
    });
  }

  async deleteLesson(id: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        blocks: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new BadRequestException('Lesson not found');
    }

    return this.prisma.$transaction(async (prisma) => {
      for (const block of lesson.blocks) {
        for (const item of block.items) {
          const itemSource = item.source as LessonItemSource;
          const itemType = item.type as LessonItemType;

          if (
            itemSource === LessonItemSource.UPLOADED &&
            itemType !== LessonItemType.TEXT
          ) {
            try {
              if (itemType === LessonItemType.AUDIO && item.audioPublicId) {
                await this.fileService.deleteFile(item.audioPublicId, 'video');
              }
              if (itemType === LessonItemType.VIDEO && item.videoPublicId) {
                await this.fileService.deleteFile(item.videoPublicId, 'video');
              }
              if (itemType === LessonItemType.IMAGE && item.photoPublicId) {
                await this.fileService.deleteFile(item.photoPublicId, 'image');
              }
            } catch (e) {
              console.warn(`Failed to delete file for item ${item.id}:`, e);
              // ошибки удаления не блокируют удаление записи из БД
            }
          }
        }

        // удалить элементы блока и сам блок
        await prisma.lessonItem.deleteMany({ where: { lessonId: block.id } });
        await prisma.lessonBlock.delete({ where: { id: block.id } });
      }

      await prisma.lesson.delete({ where: { id } });

      return { success: true };
    });
  }

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
      include: {
        blocks: {
          include: {
            items: {
              include: {
                video: true,
                audio: true,
                photo: true,
                text: true,
              },
            },
          },
        },
      },
    });
  }
}
