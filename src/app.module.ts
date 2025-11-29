import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AudioModule } from './modules/audio/audio.module';
import { FileModule } from './modules/file/file.module';
import { PhotoModule } from './modules/photo/photo.module';
import { VideoModule } from './modules/video/video.module';
import { LessonModule } from './modules/lesson/lesson.module';
import { ModuleModule } from './modules/module/module.module';
import { CategoryModule } from './modules/category/category.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    AudioModule,
    FileModule,
    PhotoModule,
    VideoModule,
    LessonModule,
    ModuleModule,
    CategoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
