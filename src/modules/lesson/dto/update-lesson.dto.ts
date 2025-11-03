import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LessonItemSource, LessonItemType } from './create-lesson.dto';
import { Type } from 'class-transformer';

export class UpdateLessonItemDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsEnum(LessonItemType)
  type: LessonItemType;

  @IsEnum(LessonItemSource)
  source: LessonItemSource;

  @IsInt()
  orderIndex: number;

  @IsOptional()
  layout?: Record<string, any>;

  @IsOptional()
  @IsInt()
  bankItemId?: number;

  @IsOptional()
  content?: string | Express.Multer.File;

  @IsOptional()
  @IsString()
  audioPublicId?: string;

  @IsOptional()
  @IsString()
  videoPublicId?: string;

  @IsOptional()
  @IsString()
  photoPublicId?: string;
}

export class UpdateLessonBlockDto {
  @IsInt()
  index: number;

  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLessonItemDto)
  items?: UpdateLessonItemDto[];
}

export class UpdateLessonDto {
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLessonBlockDto)
  blocks?: UpdateLessonBlockDto[];
}
