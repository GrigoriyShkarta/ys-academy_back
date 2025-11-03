import { Module } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [PhotoService],
  controllers: [PhotoController],
})
export class PhotoModule {}
