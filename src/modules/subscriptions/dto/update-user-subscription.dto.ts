import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class UpdateStudentSubscriptionDto {
  @IsOptional()
  @IsInt()
  subscriptionId?: number;

  @IsOptional()
  @IsArray()
  @IsISO8601({ strict: true }, { each: true })
  lessonDates?: string[]; // массив ISO строк

  @IsOptional()
  paymentStatus?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
