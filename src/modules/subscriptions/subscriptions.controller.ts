import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AbonementDto } from './dto/abonement.dto';
import { CreateStudentSubscriptionDto } from './dto/student-subscription.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdateUserLessonStatusDto } from './dto/update-user-lesson-status.dto';
import { UpdateStudentSubscriptionDto } from './dto/update-user-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async create(@Body() body: AbonementDto) {
    return this.subscriptionsService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async update(@Param('id') id: number, @Body() body: AbonementDto) {
    return this.subscriptionsService.update(id, body);
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async delete(@Body('ids') ids: number[]) {
    return this.subscriptionsService.delete(ids);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async getAll() {
    return this.subscriptionsService.getAll();
  }

  @Post('/subscribe')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async subscribe(@Body() body: CreateStudentSubscriptionDto) {
    return this.subscriptionsService.createStudentSubscription(body);
  }

  @Patch('subscribe/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async updateStudentSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentSubscriptionDto,
  ) {
    return this.subscriptionsService.updateStudentSubscription(id, dto);
  }

  @Delete('/subscribe/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteStudentSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.deleteStudentSubscription(id);
  }

  @Patch(':id/payment-status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  updatePaymentStatus(
    @Param('id') id: number,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.subscriptionsService.updatePaymentStatus(id, dto);
  }

  @Patch(':id/lesson-status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  updateLessonStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserLessonStatusDto,
  ) {
    return this.subscriptionsService.updateLessonStatus(id, dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @Patch('lessons/:lessonId/recording')
  addRecording(
    @Param('lessonId') lessonId: number,
    @Body() dto: { recordingUrl: string },
  ) {
    return this.subscriptionsService.addRecordingToLesson(
      +lessonId,
      dto.recordingUrl,
    );
  }
}
