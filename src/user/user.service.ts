import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { studentSelect, userSelect } from './select/user.select';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  async getStudentById(id: number) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    if (!student) return null;

    const modules = await this.prisma.module.findMany({
      include: {
        lessons: {
          include: {
            userLessonAccesses: {
              where: { userId: id },
              select: { id: true },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const modulesWithAccess = modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => {
        const totalBlocks = Array.isArray(l.content) ? l.content.length : 0;

        const accessRecord =
          Array.isArray(student.userLessonAccesses) &&
          student.userLessonAccesses.length > 0
            ? (student.userLessonAccesses.find((a) => a.lessonId === l.id) ??
              null)
            : null;

        const availableBlocks =
          accessRecord && Array.isArray(accessRecord.blocks)
            ? accessRecord.blocks.length
            : 0;

        const availableBlockIds = student.userLessonAccesses.find(
          (lesson) => lesson.lessonId === l.id,
        )?.blocks;

        return {
          id: l.id,
          title: l.title,
          access: availableBlocks > 0,
          access_blocks: availableBlockIds ?? [],
          blocks: `${availableBlocks}/${totalBlocks}`,
        };
      }),
    }));

    return {
      ...student,
      modules: modulesWithAccess,
    };
  }

  async getAllStudents(params: {
    page: number | 'all';
    search?: string;
    limit?: number;
  }) {
    const { page = 1, search = '', limit = 15 } = params;

    const take = 20;
    const isAll = page === 'all';
    const skip = isAll ? undefined : (Number(page === 0 ? 1 : page) - 1) * take;

    const where: Prisma.UserWhereInput = {
      role: 'student',
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [students, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: studentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: students,
      meta: {
        total,
        page,
        totalPages,
        limit,
      },
    };
  }

  async create(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
    });
    return true;
  }
}
