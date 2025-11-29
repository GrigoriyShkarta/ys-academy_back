import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Body('form') body: { title: string; color?: string }[]) {
    return this.categoryService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  update(
    @Param('id') id: number,
    @Body('form') body: { title: string; color?: string },
  ) {
    return this.categoryService.update(id, body);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  getCategories(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    let pageParam: number | 'all' | undefined;

    if (page === 'all') {
      pageParam = 'all';
    } else if (page) {
      const n = Number(page);
      pageParam = Number.isInteger(n) ? n : undefined;
    } else {
      pageParam = undefined;
    }

    // нормализуем sortOrder
    const order =
      sortOrder && sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return this.categoryService.getAll(pageParam, search || '', sortBy, order);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async delete(@Body('ids') ids: number[]) {
    return this.categoryService.deleteMany(ids);
  }
}
