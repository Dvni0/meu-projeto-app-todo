import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinClassroomDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code!: string;
}