import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ExamFiltersDto {
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @IsOptional()
  @IsIn(['scheduled', 'cancelled'])
  status?: 'scheduled' | 'cancelled';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}