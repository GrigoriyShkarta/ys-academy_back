import { Module } from '@nestjs/common';
import { TrackersController } from './trackers.controller';
import { TrackersService } from './trackers.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [TrackersController],
  providers: [TrackersService],
})
export class TrackersModule {}
