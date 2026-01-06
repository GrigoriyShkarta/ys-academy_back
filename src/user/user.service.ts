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

    const isAll = page === 'all';
    const skip = isAll
      ? undefined
      : (Number(page === 0 ? 1 : page) - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: 'student',
      isActive: true, // <- Фильтруем только активных
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Получаем всех активных студентов
    const [allStudents, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: studentSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Функция для получения последней даты урока
    const getLastLessonTimestamp = (student: any): number => {
      console.log('student', student);
      if (!student.subscriptions || student.subscriptions.length === 0) {
        return 0;
      }

      const allLessons = student.subscriptions.flatMap(
        (sub: any) => sub.lessons || [],
      );

      if (allLessons.length === 0) return 0;

      return Math.max(
        ...allLessons.map((lesson: any) =>
          new Date(lesson.scheduledAt).getTime(),
        ),
      );
    };

    // Получаем текущую временную метку
    const now = Date.now();

    // Сортируем: ближайшие к сегодня - сверху
    allStudents.sort((a, b) => {
      const dateA = getLastLessonTimestamp(a);
      const dateB = getLastLessonTimestamp(b);

      // Если нет уроков - в конец
      if (dateA === 0 && dateB === 0) return 0;
      if (dateA === 0) return 1;
      if (dateB === 0) return -1;

      // Вычисляем разницу с сегодняшним днем (по модулю)
      const diffA = Math.abs(now - dateA);
      const diffB = Math.abs(now - dateB);

      // Чем меньше разница - тем выше в списке
      return diffA - diffB;
    });

    // Применяем пагинацию
    const students = isAll
      ? allStudents
      : allStudents.slice(skip, skip! + limit);

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
