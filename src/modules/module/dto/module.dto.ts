import { IsArray, IsOptional, IsString } from 'class-validator';

export class ModuleDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsOptional()
  lessons?: {
    id: number;
    index: number;
  }[];

  @IsArray()
  @IsOptional()
  categories?: number[];
}
