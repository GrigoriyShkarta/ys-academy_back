// src/modules/board/board-sync.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BoardService } from './modules/boards/board.service';

@WebSocketGateway({
  namespace: 'board-sync',
  cors: {
    origin: [
      'https://ys-academy.vercel.app',
      'https://ys-academy-dev.vercel.app',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class BoardSyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly boardService: BoardService) {}

  async handleConnection(client: Socket) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };

    if (!roomId) {
      client.disconnect();
      return;
    }

    const roomName = `room-${roomId}`;
    await client.join(roomName);

    // Отправляем текущее состояние доски клиенту
    try {
      const records = await this.boardService.getBoardRecords(roomId);
      client.emit('init', records);
      console.log(
        `✅ User ${userId} joined room ${roomId}, sent ${records.length} records`,
      );
    } catch (error) {
      console.error(`❌ Error loading board for room ${roomId}:`, error);
      client.emit('init', []); // Отправляем пустую доску в случае ошибки
    }
  }

  handleDisconnect(client: Socket) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    console.log(`👋 User ${userId} left room ${roomId}`);
  }

  // Получаем изменения и сохраняем в БД + рассылаем всем
  @SubscribeMessage('update')
  async handleUpdate(client: Socket, payload: any) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    try {
      // ⬇️ ИСПРАВЛЕНИЕ: Flatten если payload это вложенный массив
      let records = Array.isArray(payload) ? payload : [payload];

      // Если первый элемент тоже массив - flatten
      if (records.length > 0 && Array.isArray(records[0])) {
        records = records.flat();
      }

      console.log('📥 Received update:', records.length, 'records');

      // Сохраняем в БД
      await this.boardService.updateBoardRecords(roomId, records);

      // Рассылаем всем, кроме отправителя
      client.to(roomName).emit('update', records);

      console.log(`💾 Updated ${records.length} records in room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error updating board ${roomId}:`, error);
    }
  }

  // Удаление элементов доски
  @SubscribeMessage('delete')
  async handleDelete(client: Socket, payload: any) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    try {
      // Payload должен быть массивом ID: string[]
      const recordIds = Array.isArray(payload) ? payload : [payload];

      // Удаляем из БД
      await this.boardService.deleteBoardRecords(roomId, recordIds);

      // Рассылаем всем, кроме отправителя
      client.to(roomName).emit('delete', recordIds);

      console.log(`🗑️ Deleted ${recordIds.length} records from room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error deleting from board ${roomId}:`, error);
    }
  }

  // Клиент запрашивает текущее состояние доски
  @SubscribeMessage('get-board')
  async handleGetBoard(client: Socket, payload: { roomId: string }) {
    try {
      const records = await this.boardService.getBoardRecords(payload.roomId);
      client.emit('init', records);
      console.log(
        `📤 Sent ${records.length} records to client for room ${payload.roomId}`,
      );
    } catch (error) {
      console.error(`❌ Error fetching board ${payload.roomId}:`, error);
      client.emit('init', []);
    }
  }

  // Обработка движения курсора (без сохранения в БД)
  @SubscribeMessage('cursor')
  handleCursor(client: Socket, payload: any) {
    const { roomId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    // Рассылаем всем, кроме отправителя
    client.to(roomName).emit('cursor', payload);
  }
}
