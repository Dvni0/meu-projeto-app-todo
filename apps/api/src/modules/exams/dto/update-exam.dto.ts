import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MaterialUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url!: string;
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999.99)
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MaterialUpdateDto)
  materials?: MaterialUpdateDto[];

  @IsOptional()
  @IsIn(['scheduled', 'cancelled'])
  status?: 'scheduled' | 'cancelled';
}