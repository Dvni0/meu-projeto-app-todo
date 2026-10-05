import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}