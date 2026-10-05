import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject!: string;
}