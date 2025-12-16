import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { FileModule } from '../modules/file/file.module';

@Module({
  imports: [FileModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
