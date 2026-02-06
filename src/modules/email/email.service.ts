import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma.service';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly prisma: PrismaService) {
    // Инициализация транспортера для отправки email
    // Настройки берутся из переменных окружения
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true для 465, false для других портов
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Генерация HTML шаблона письма с темно-синим дизайном
   */
  private generateEmailTemplate(
    userName: string,
    title: string,
    content: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f7fa;
            padding: 20px;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .email-header {
            background: linear-gradient(to bottom, #111827, #1f2937);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
          }
          .email-header h1 {
            font-size: 28px;
            font-weight: 600;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .email-body {
            padding: 40px 30px;
            color: #2d3748;
            line-height: 1.6;
          }
          .greeting {
            font-size: 18px;
            color: #1a365d;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .content {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 20px;
          }
          .highlight-box {
            background-color: #e6f2ff;
            border-left: 4px solid #2c5282;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
          }
          .highlight-box strong {
            color: #1a365d;
            font-size: 18px;
            display: block;
            margin-bottom: 8px;
          }
          .highlight-box p {
            color: #2d3748;
            margin: 0;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
            color: #ffffff !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 20px;
            font-size: 16px;
          }
          .email-footer {
            background: linear-gradient(to bottom, #111827, #1f2937);
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .email-footer p {
            color: white;
            font-size: 14px;
            margin: 5px 0;
          }
          .email-footer .brand {
            font-weight: 600;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1>${title}</h1>
          </div>
          <div class="email-body">
            <div class="greeting">Привіт, ${userName}!</div>
            <div class="content">
              ${content}
            </div>
          </div>
          <div class="email-footer">
            <img src="cid:ys-vocal-academy-logo" alt="YS Vocal Academy logo" style="width:60px;display:block;margin:0 auto 6px auto;">
            <p>З турботою про ваш вокальний розвиток</p>
            <p class="brand">YS Vocal Academy</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Отправка email пользователю
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(
          'SMTP credentials not configured. Email sending is disabled.',
        );
        return;
      }

      // Путь к логотипу для вложения (cid)
      const logoPath = path.join(
        __dirname, // dist/modules/email
        '..',
        '..',
        '..',
        'public',
        'assets',
        'images',
        'logo.png',
      );

      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM,
        to,
        subject,
        html,
        attachments: [
          {
            filename: 'logo.png',
            path: logoPath,
            cid: 'ys-vocal-academy-logo',
          },
        ],
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.log(`Failed to send email to ${to}:`, error);
      // Не пробрасываем ошибку, чтобы не ломать основной функционал
    }
  }

  /**
   * Отправка уведомления о новой задаче в трекере
   */
  async sendTrackerTaskNotification(
    userId: number,
    taskTitle: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user || !user.email) {
        console.log(`User ${userId} not found or has no email`);
        return;
      }

      const subject = 'Нова задача в трекері';
      const content = `
        <p>Вам було додано нову задачу в трекер:</p>
        <div class="highlight-box">
          <strong>${taskTitle}</strong>
        </div>
        <p>Будь ласка, перевірте свій трекер для отримання детальної інформації.</p>
        <a href="https://ys-academy.vercel.app/main/tracker" style="display:block; width: fit-content; margin: 25px auto 0; background-color:#0b1f3a; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:6px; font-size:15px;">
            Перейти до трекера
        </a>
      `;

      const html = this.generateEmailTemplate(
        user.name,
        'Нова задача',
        content,
      );

      await this.sendEmail(user.email, subject, html);
    } catch (error) {
      console.log(
        `Failed to send tracker task notification to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Отправка уведомления о новой записи урока
   */
  async sendUserLessonNotification(userId: number): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user || !user.email) {
        console.log(`User ${userId} not found or has no email`);
        return;
      }

      const subject = 'Новий запис уроку';
      const content = `
        <p>Вам було додано новий запис до уроку.</p>
        <p>Перегляньте його в особистому кабінеті.</p>
        <a href="https://ys-academy.vercel.app/main/lesson-recordings" style="display:block; width: fit-content; margin: 25px auto 0; background-color:#0b1f3a; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:6px; font-size:15px;">
            Перейти до записів уроків
        </a>
      `;

      const html = this.generateEmailTemplate(
        user.name,
        'Новий запис уроку',
        content,
      );

      await this.sendEmail(user.email, subject, html);
    } catch (error) {
      console.log(
        `Failed to send user lesson notification to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Отправка уведомления о предоставлении доступа к уроку
   */
  async sendLessonAccessNotification(
    userId: number,
    lessonTitles: string[],
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user || !user.email) {
        console.log(`User ${userId} not found or has no email`);
        return;
      }

      if (lessonTitles.length === 0) {
        return;
      }

      const subject =
        lessonTitles.length === 1
          ? 'Вам надано доступ до уроку'
          : 'Вам надано доступ до уроків';

      // Формируем список уроков
      const lessonsList = lessonTitles
        .map((title) => `<li style="margin-bottom: 10px;">${title}</li>`)
        .join('');

      const content = `
        <p>Вам було надано доступ до ${lessonTitles.length === 1 ? 'нового уроку' : 'нових уроків'}:</p>
        <div class="highlight-box">
          <ul style="margin: 0; padding-left: 20px; list-style-type: none;">
            ${lessonsList}
          </ul>
        </div>
        <p>Тепер ви можете переглянути ${lessonTitles.length === 1 ? 'цей урок' : 'ці уроки'} у своєму особистому кабінеті.</p>
        <p>Не забудьте увійти в систему та почати навчання!</p>
        <a href="https://ys-academy.vercel.app/main/courses" style="display:block; width: fit-content; margin: 25px auto 0; background-color:#0b1f3a; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:6px; font-size:15px;">
            Перейти до курсів
        </a>
      `;

      const html = this.generateEmailTemplate(
        user.name,
        lessonTitles.length === 1
          ? 'Новий доступ до уроку'
          : 'Новий доступ до уроків',
        content,
      );

      await this.sendEmail(user.email, subject, html);
    } catch (error) {
      console.log(
        `Failed to send lesson access notification to user ${userId}:`,
        error,
      );
    }
  }
}
