import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ModuleLessonDto {
  @IsInt()
  id: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

export class ModuleDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleLessonDto)
  @IsOptional()
  lessons?: ModuleLessonDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}
