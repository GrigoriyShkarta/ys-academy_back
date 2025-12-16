import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { RequestWithUser } from '../common/types/request-with-user.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: RequestWithUser) {
    return this.userService.findById(req.user.id);
  }

  @Get('/students')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getAllStudents(
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    return this.userService.getAllStudents({
      page: Number(page) || 1,
      search: search || '',
    });
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getStudent(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.userService.getStudentById(Number(id), req.user.role);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  updateStudent(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.userService.updateUser(+id, body);
  }
}
