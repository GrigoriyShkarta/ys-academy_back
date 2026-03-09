import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UserTasksService {
  private readonly logger = new Logger(UserTasksService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Automatically deactivates users whose deactivationDate has passed.
   * Runs every day at midnight (00:00).
   * When deactivated, users get 7 days of grace period (accessExpiryDate).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUserDeactivation() {
    this.logger.log('Starting scheduled user deactivation check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const gracePeriod = new Date();
    gracePeriod.setDate(gracePeriod.getDate() + 7);

    try {
      // Find students who should be deactivated
      // They must be active and have a deactivationDate that is today or earlier
      const result = await this.prisma.user.updateMany({
        where: {
          role: 'student',
          isActive: true, // or status: UserStatus.active
          deactivationDate: {
            lte: today,
          },
        },
        data: {
          isActive: false,
          status: UserStatus.inactive,
          accessExpiryDate: gracePeriod,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Successfully deactivated ${result.count} users. Grace period set to ${gracePeriod.toISOString()}`);
      } else {
        this.logger.log('No users to deactivate today.');
      }
    } catch (error) {
      this.logger.error('Error during scheduled user deactivation:', error);
    }
  }
}
