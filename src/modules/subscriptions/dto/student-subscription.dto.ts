import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

enum PaymentStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  PARTIAL_PAID = 'partial_paid',
}

export class CreateStudentSubscriptionDto {
  @IsInt()
  userId: number;

  @IsInt()
  subscriptionId: number;

  @IsArray()
  @IsOptional()
  @IsISO8601({}, { each: true })
  lessonDates?: string[];

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lessonDays?: string[];

  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @IsOptional()
  @IsISO8601()
  nextPaymentDate?: string;
}
