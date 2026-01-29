// src/modules/board/board.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Получить все записи доски для roomId (tldraw - legacy)
   */
  async getBoardRecords(roomId: string) {
    const records = await this.prisma.boardRecord.findMany({
      where: { roomId },
      select: {
        content: true,
      },
    });

    console.log('📤 Loaded records from DB:', records.length);

    return records.map((r) => r.content);
  }

  /**
   * Обновить или создать записи (UPSERT) с обработкой файлов (tldraw - legacy)
   */
  async updateBoardRecords(roomId: string, records: any[]) {
    const flatRecords = Array.isArray(records[0]) ? records.flat() : records;

    console.log('💾 Saving records:', flatRecords);

    // Просто сохраняем все записи как есть
    await this.prisma.$transaction(
      flatRecords.map((record) =>
        this.prisma.boardRecord.upsert({
          where: {
            roomId_recordId: {
              roomId,
              recordId: record.id as string,
            },
          },
          create: {
            roomId,
            recordId: record.id as string,
            content: record,
          },
          update: {
            content: record,
            updatedAt: new Date(),
          },
        }),
      ),
    );

    return {
      success: true,
      updated: flatRecords.length,
    };
  }

  async uploadFile(file: Express.Multer.File) {
    try {
      const fileType = this.getFileTypeFromMime(file.mimetype);

      // Загружаем в Cloudinary
      const uploadResult = await this.fileService.uploadFile(
        file,
        fileType,
        true, // isOther = true
      );

      return {
        src: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    } catch (e) {
      console.error('Error uploading file:', e);
      return null;
    }
  }

  /**
   * Удалить записи по ID с удалением файлов из Cloudinary
   */
  async deleteBoardRecords(roomId: string, recordIds: string[]) {
    console.log(`🗑️ Deleting records: ${recordIds.join(', ')}`);

    // Получаем записи из БД
    const records = await this.prisma.boardRecord.findMany({
      where: {
        roomId,
        recordId: { in: recordIds },
      },
      select: {
        recordId: true,
        content: true,
      },
    });

    const assetIdsToDelete = new Set<string>();
    const recordIdsToDelete = new Set<string>(recordIds);

    // Проходим по всем записям
    for (const record of records) {
      const content = record.content as any;

      // Если это shape с изображением/видео
      if (
        content?.typeName === 'shape' &&
        (content.type === 'image' || content.type === 'video') &&
        content.props?.assetId
      ) {
        console.log(
          `🔗 Shape ${content.id} references asset ${content.props.assetId}`,
        );
        // Запоминаем assetId для удаления
        assetIdsToDelete.add(content.props.assetId);
        recordIdsToDelete.add(content.props.assetId);
      }

      // Если это asset с publicId
      if (content?.typeName === 'asset' && content?.meta?.publicId) {
        console.log(
          `📎 Found asset ${content.id} with publicId ${content.meta.publicId}`,
        );
        assetIdsToDelete.add(content.id);
      }
    }

    // Получаем все assets для удаления
    if (assetIdsToDelete.size > 0) {
      const assets = await this.prisma.boardRecord.findMany({
        where: {
          roomId,
          recordId: { in: Array.from(assetIdsToDelete) },
        },
        select: {
          recordId: true,
          content: true,
        },
      });

      // Удаляем файлы из Cloudinary
      for (const asset of assets) {
        const content = asset.content as any;

        if (content?.meta?.publicId) {
          try {
            const fileType = this.getFileTypeFromPublicId(
              content.meta.publicId,
            );
            await this.fileService.deleteFile(content.meta.publicId, fileType);
            console.log(
              `✅ Deleted file from Cloudinary: ${content.meta.publicId}`,
            );
          } catch (error) {
            console.error(
              `❌ Error deleting file ${content.meta.publicId}:`,
              error,
            );
          }
        }
      }
    }

    // Удаляем все записи (shapes и assets) из БД
    const result = await this.prisma.boardRecord.deleteMany({
      where: {
        roomId,
        recordId: { in: Array.from(recordIdsToDelete) },
      },
    });

    console.log(`🗑️ Deleted ${result.count} records from room ${roomId}`);

    return { success: true, deleted: result.count };
  }

  /**
   * Удалить всю доску и все файлы
   */

  /**
   * Определить тип файла по publicId
   */
  private getFileTypeFromPublicId(publicId: string): 'image' | 'video' | 'raw' {
    if (publicId.includes('/images/')) return 'image';
    if (publicId.includes('/videos/')) return 'video';
    if (publicId.includes('/audio/')) return 'video';
    return 'raw';
  }

  private getFileTypeFromMime(mimetype: string): 'image' | 'video' | 'raw' {
    console.log('mimetype', mimetype);
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    return 'raw';
  }
}
