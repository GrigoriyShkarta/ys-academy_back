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

  async getStudentById(id: number, role: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userLessonAccesses: true,
      },
    });

    if (!student) return null;

    // Загружаем курсы со всеми модулями и уроками
    const courses = await this.prisma.course.findMany({
      include: {
        modules: {
          include: {
            moduleLessons: {
              orderBy: { order: 'asc' },
              include: {
                lesson: true,
              },
            },
          },
        },
      },
    });

    const coursesWithAccess = courses.map((course) => {
      let hasCourseAccess = false;

      let totalLessons = 0;
      let lessonsWithAccess = 0;

      const modules = course.modules.map((module) => {
        const lessons = module.moduleLessons.map((ml) => {
          const lesson = ml.lesson;
          totalLessons++;

          const accessRecord = student.userLessonAccesses.find(
            (a) => a.lessonId === lesson.id,
          );

          const availableBlocks = accessRecord?.blocks?.length ?? 0;
          const hasAccess = availableBlocks > 0;

          if (hasAccess) {
            hasCourseAccess = true;
            lessonsWithAccess++;
          }

          return {
            id: lesson.id,
            title: lesson.title,
            access: hasAccess,
            access_blocks: accessRecord?.blocks ?? [],
          };
        });

        return {
          id: module.id,
          title: module.title,
          lessons,
        };
      });

      // super_admin → всегда 100%
      const progress =
        role === 'super_admin'
          ? 100
          : totalLessons === 0
            ? 0
            : Math.round((lessonsWithAccess / totalLessons) * 100);

      return {
        id: course.id,
        title: course.title,
        url: course.url,
        access: role === 'super_admin' ? true : hasCourseAccess,
        progress, // <-- добавлено новое поле
        modules,
      };
    });

    return {
      ...student,
      courses: coursesWithAccess,
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
