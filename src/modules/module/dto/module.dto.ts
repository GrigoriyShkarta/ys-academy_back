import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ModuleDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : []))
  lessonsId?: number[];

  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : []))
  lessonsIndex?: number[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AltTitle)
  altTitles?: AltTitle[];
}

class AltTitle {
  @IsString()
  key: string;

  @IsString()
  value: string;
}
