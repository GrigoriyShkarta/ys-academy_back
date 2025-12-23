import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

export enum UpdateLessonStatus {
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  TRANSFERRED = 'transfer',
  PENDING = 'pending',
}

export class UpdateUserLessonStatusDto {
  @IsEnum(UpdateLessonStatus)
  status: UpdateLessonStatus;

  /**
   * Новая дата и время урока
   * обязательна ТОЛЬКО если status === TRANSFERRED
   */
  @IsOptional()
  @IsISO8601()
  transferredTo?: string;
}
