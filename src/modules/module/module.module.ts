import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [ModuleService],
  controllers: [ModuleController],
})
export class ModuleModule {}
