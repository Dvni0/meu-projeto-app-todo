import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateChecklistItemDto {
  @IsUUID()
  examId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;
}