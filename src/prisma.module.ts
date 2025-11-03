import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // чтобы использовать в любом модуле без повторного импорта
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
