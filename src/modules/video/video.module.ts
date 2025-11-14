import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [VideoService],
  controllers: [VideoController],
})
export class VideoModule {}
