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
   * Получить все записи доски для roomId
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
   * Обновить или создать записи (UPSERT) с обработкой файлов
   */
  async updateBoardRecords(roomId: string, records: any[]) {
    // 1. Приводим к плоскому массиву
    const flatRecords = Array.isArray(records[0]) ? records.flat() : records;

    console.log('💾 Incoming records:', flatRecords.length);

    // 2. Обрабатываем ТОЛЬКО assets с base64
    const processedRecords = await Promise.all(
      flatRecords.map(async (record) => {
        console.log('record', record);
        const isAsset =
          record?.typeName === 'asset' &&
          typeof record?.props?.src === 'string';
        console.log('isAsset', isAsset);
        const isBase64 = isAsset && record.props.src.startsWith('data:');
        console.log('isBase64', isBase64);
        if (!isBase64) {
          return record;
        }

        console.log(`📤 Uploading asset: ${record.id}`);

        try {
          const [meta, base64] = record.props.src.split(',');
          const buffer = Buffer.from(base64, 'base64');

          const mimeType =
            record.props.mimeType ||
            meta.match(/data:(.*?);base64/)?.[1] ||
            'application/octet-stream';

          const extension = mimeType.split('/')[1] ?? 'bin';

          const file: Express.Multer.File = {
            buffer,
            originalname: record.props.name || `${record.id}.${extension}`,
            mimetype: mimeType,
            size: buffer.length,
            fieldname: 'file',
            encoding: '7bit',
          } as Express.Multer.File;

          const uploadResult = await this.fileService.uploadFile(
            file,
            record.type, // image | video
            true,
          );

          console.log(`✅ Uploaded ${record.type}: ${uploadResult.public_id}`);

          // 3. Возвращаем обновлённый asset
          return {
            ...record,
            props: {
              ...record.props,
              src: uploadResult.secure_url, // <-- URL вместо base64
            },
            meta: {
              ...record.meta,
              publicId: uploadResult.public_id,
            },
          };
        } catch (error) {
          console.error(`❌ Failed to upload asset ${record.id}:`, error);
          return record;
        }
      }),
    );

    // 4. Сохраняем ВСЕ records (и assets, и shapes)
    await this.prisma.$transaction(
      processedRecords.map((record) =>
        this.prisma.boardRecord.upsert({
          where: {
            roomId_recordId: {
              roomId,
              recordId: record.id,
            },
          },
          create: {
            roomId,
            recordId: record.id,
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
      updated: processedRecords.length,
    };
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

    // Проверяем каждую запись на наличие publicId
    for (const record of records) {
      const content = record.content as any;

      // Проверяем, есть ли publicId в meta
      if (content?.meta?.publicId) {
        try {
          const fileType = this.getFileTypeFromPublicId(content.meta.publicId);
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

    // Удаляем записи из БД
    const result = await this.prisma.boardRecord.deleteMany({
      where: {
        roomId,
        recordId: { in: recordIds },
      },
    });

    console.log(`🗑️ Deleted ${result.count} records from room ${roomId}`);

    return { success: true, deleted: result.count };
  }

  /**
   * Удалить всю доску и все файлы
   */
  async deleteBoard(roomId: string) {
    console.log(`🗑️ Deleting board: ${roomId}`);

    // Получаем все записи доски
    const records = await this.prisma.boardRecord.findMany({
      where: { roomId },
      select: {
        recordId: true,
        content: true,
      },
    });

    let deletedFiles = 0;

    // Удаляем файлы из Cloudinary
    for (const record of records) {
      const content = record.content as any;

      if (content?.meta?.publicId) {
        try {
          const fileType = this.getFileTypeFromPublicId(content.meta.publicId);
          await this.fileService.deleteFile(content.meta.publicId, fileType);
          deletedFiles++;
          console.log(`✅ Deleted file: ${content.meta.publicId}`);
        } catch (error) {
          console.error(
            `❌ Error deleting file ${content.meta.publicId}:`,
            error,
          );
        }
      }
    }

    // Удаляем все записи доски
    await this.prisma.boardRecord.deleteMany({
      where: { roomId },
    });

    console.log(`🗑️ Deleted board ${roomId} with ${deletedFiles} files`);

    return { success: true, deletedRecords: records.length, deletedFiles };
  }

  /**
   * Определить тип файла по publicId
   */
  private getFileTypeFromPublicId(publicId: string): 'image' | 'video' | 'raw' {
    if (publicId.includes('/images/')) return 'image';
    if (publicId.includes('/videos/')) return 'video';
    return 'raw';
  }
}
