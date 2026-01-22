// src/modules/board/board.module.ts
import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma.service';
import { BoardService } from './board.service';
import { BoardSyncGateway } from '../../board-sync.gateway';
import { BoardController } from './board.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [BoardSyncGateway, BoardService, PrismaService],
  controllers: [BoardController],
  exports: [BoardService],
})
export class BoardModule {}
