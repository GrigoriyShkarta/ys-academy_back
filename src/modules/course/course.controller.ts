import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CourseDto } from './dto/course.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async createModule(@Body() body: CourseDto) {
    return this.courseService.createCourse(body);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteCourse(@Param('id') id: number) {
    return this.courseService.deleteCourse(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getAllModules(
    @Query('search') search?: string,
    @Query('categories') categories?: string[],
  ) {
    let categoriesFormated: string[] = [];
    if (Number(categories)) {
      categoriesFormated = [String(categories)];
    } else {
      categoriesFormated = categories || [];
    }
    return this.courseService.getCourses({
      search: search || '',
      categories: categoriesFormated,
    });
  }

  @Put('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('image'))
  async updateCourse(@Param('id') id: number, @Body() body: CourseDto) {
    return this.courseService.updateCourse(id, body);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getModule(@Param('id') id: number, @Query('userId') userId?: number) {
    return this.courseService.getCourse(id, userId);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteModule(@Param('id') id: number) {
    return this.courseService.deleteCourse(id);
  }

  @Get('fix-timestamps')
  async fixTimestamps() {
    return this.courseService.fixCoursesTimestamps();
  }
}
