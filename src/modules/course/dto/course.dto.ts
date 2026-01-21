import { IsArray, IsOptional, IsString } from 'class-validator';

export class CourseDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  publicImgId?: string;

  @IsArray()
  @IsOptional()
  categories?: number[];

  @IsArray()
  @IsOptional()
  modules?: {
    id: number;
    index: number;
  }[];

  @IsArray()
  @IsOptional()
  lessons?: {
    id: number;
    order: number;
  }[];
}
