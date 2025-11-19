import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

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
        cover: dto?.cover ?? '',
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
        cover: dto?.cover ?? '',
        content: dto.blocks || [],
      },
    });
  }

  async deleteLesson(id: number) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new BadRequestException('Lesson not found');

    await this.prisma.lesson.delete({ where: { id } });
    return { success: true };
  }

  async getUnassignedLessons(search = '') {
    return this.prisma.lesson.findMany({
      where: {
        title: {
          contains: search,
          mode: 'insensitive', // не учитываем регистр
        },
      },
      orderBy: {
        createdAt: 'desc',
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
