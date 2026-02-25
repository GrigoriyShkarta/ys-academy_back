import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { FileModule } from '../modules/file/file.module';

import { UserTasksService } from './user-tasks.service';

@Module({
  imports: [FileModule],
  controllers: [UserController],
  providers: [UserService, UserTasksService],
})
export class UserModule {}
