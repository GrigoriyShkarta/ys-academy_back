import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentStatusDto {
  @IsString()
  paymentStatus: string;

  @IsOptional()
  @IsInt()
  amount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  nextPaymentDate?: string;
}
