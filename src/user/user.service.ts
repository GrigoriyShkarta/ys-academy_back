import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { studentSelect, userSelect } from './select/user.select';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileService } from '../modules/file/file.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  isLessonCompleted(scheduledAt: Date, now: Date) {
    const completedAfter = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
    return now >= completedAfter;
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  async getStudentById(id: number, role: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    if (!student) return null;

    const now = new Date();

    const lessonsToComplete = student.subscriptions
      .flatMap((sub) => sub.lessons)
      .filter(
        (lesson) =>
          lesson.status === 'pending' &&
          this.isLessonCompleted(new Date(lesson.scheduledAt), now),
      );

    if (lessonsToComplete.length > 0) {
      await this.prisma.$transaction(
        lessonsToComplete.map((lesson) =>
          this.prisma.userLesson.update({
            where: { id: lesson.id },
            data: {
              status: 'completed',
              completedAt: now,
            },
          }),
        ),
      );
    }

    const updatedStudent = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    updatedStudent?.subscriptions.forEach((sub) => {
      sub.lessons.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    });

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
      const progress = Math.round((lessonsWithAccess / totalLessons) * 100);

      return {
        id: course.id,
        title: course.title,
        url: course.url,
        access: hasCourseAccess,
        progress, // <-- добавлено новое поле
        modules,
      };
    });

    return {
      ...updatedStudent,
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

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    photo?: Express.Multer.File,
  ) {
    let photoUrl: string | undefined;
    let photoPublicId: string | undefined;

    if (photo) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (user?.photoId) {
        await this.fileService.deleteFile(user.photoId, 'image');
      }

      const uploaded = await this.fileService.uploadFile(photo, 'image', true);
      photoUrl = uploaded.url;
      photoPublicId = uploaded.public_id;
    }

    // Подготавливаем данные для обновления
    const updateData = {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      photo: photoUrl,
      photoId: photoPublicId,
    };

    // Хешируем пароль, если он передан
    if (dto?.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }
}
