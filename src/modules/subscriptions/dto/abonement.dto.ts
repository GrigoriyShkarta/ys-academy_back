import { IsInt, IsString } from 'class-validator';

export class AbonementDto {
  @IsString()
  title: string;

  @IsInt()
  price: number;

  @IsInt()
  lessons_count: number;
}
