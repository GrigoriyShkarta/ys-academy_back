import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { RequestWithUser } from '../common/types/request-with-user.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReadNotificationsDto } from './dto/read-notifications.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: RequestWithUser) {
    return this.userService.findById(req.user.id);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(Number(id));
  }

  @Get('/students')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllStudents(
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    console.log('params', page, search)
    return this.userService.getAllStudents({
      page: page === 'all' ? 'all' : Number(page ?? 1),
      search: search || '',
    });
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  // ⬇️ ПЕРЕМЕСТИТЕ ЭТИ ДВА МАРШРУТА СЮДА (до @Patch(':id'))
  @Patch('notifications')
  @UseGuards(AuthGuard('jwt'))
  readNotifications(@Body() dto: ReadNotificationsDto) {
    return this.userService.roadNotifications(dto.notificationsIds);
  }

  @Delete('notifications/:id')
  @UseGuards(AuthGuard('jwt'))
  deleteNotification(@Param('id') id: string) {
    return this.userService.deleteNotifications(Number(id));
  }

  // ⬇️ ДИНАМИЧЕСКИЕ МАРШРУТЫ ВСЕГДА ДОЛЖНЫ БЫТЬ В КОНЦЕ
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getStudent(@Param('id') id: string) {
    return this.userService.getStudentById(Number(id));
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('photo'))
  updateStudent(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.userService.updateUser(+id, body, photo);
  }
}
