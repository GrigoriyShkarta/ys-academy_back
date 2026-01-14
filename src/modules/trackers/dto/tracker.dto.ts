import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrackerColumnId } from 'generated/prisma/client';

class SubtaskInputDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

class SubtaskUpdateDto {
  @IsOptional()
  @IsInt()
  id?: number; // Если есть id - обновляем, если нет - создаем

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CreateTrackerTaskDto {
  @IsInt()
  userId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TrackerColumnId)
  columnId: TrackerColumnId;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtaskInputDto)
  subtasks?: SubtaskInputDto[];
}

export class UpdateTrackerTaskDto {
  @IsInt()
  userId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtaskUpdateDto)
  subtasks?: SubtaskUpdateDto[];
}

export class MoveTrackerTaskDto {
  @IsInt()
  userId: number;

  @IsEnum(TrackerColumnId)
  columnId: TrackerColumnId;

  @IsOptional()
  @IsInt()
  newOrder?: number;
}
