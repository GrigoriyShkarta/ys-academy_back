import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateStudentSubscriptionDto {
  @IsOptional()
  @IsInt()
  subscriptionId?: number;

  @IsOptional()
  @IsArray()
  @IsISO8601({ strict: true }, { each: true })
  lessonDates?: string[];

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

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
