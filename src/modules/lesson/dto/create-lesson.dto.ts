import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LessonItemType {
  TEXT = 'text',
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
}

export enum LessonItemSource {
  CUSTOM = 'custom',
  BANK = 'bank',
  UPLOADED = 'uploaded',
}

export class CreateLessonItemDto {
  @IsEnum(LessonItemType)
  type: LessonItemType;

  @IsEnum(LessonItemSource)
  source: LessonItemSource;

  @IsInt()
  orderIndex: number;

  @IsOptional()
  layout?: Record<string, any>;

  // ID для связи с банками (если source = 'bank')
  @IsOptional()
  @IsInt()
  bankItemId?: number;

  @IsNotEmpty()
  content: string | Express.Multer.File;
}

export class CreateLessonBlockDto {
  @IsInt()
  index: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLessonItemDto)
  items: CreateLessonItemDto[];
}

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLessonBlockDto)
  blocks: CreateLessonBlockDto[];
}
