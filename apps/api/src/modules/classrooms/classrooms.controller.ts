import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/auth.types';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { JoinClassroomDto } from './dto/join-classroom.dto';

@Controller('classrooms')
@UseGuards(AuthGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClassroomDto) {
    return this.classroomsService.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.classroomsService.list(user);
  }

  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinClassroomDto) {
    return this.classroomsService.join(user, dto.code);
  }

  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') classroomId: string) {
    return this.classroomsService.members(user, classroomId);
  }
}