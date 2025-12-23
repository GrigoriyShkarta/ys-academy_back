import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional } from 'class-validator';

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
  @IsISO8601({}, { each: true })
  lessonDates: string[];

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
