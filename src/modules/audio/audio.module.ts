import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [AudioService],
  controllers: [AudioController],
})
export class AudioModule {}
