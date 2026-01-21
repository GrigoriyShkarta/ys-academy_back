import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'board-sync',
  cors: {
    origin: [
      'http://localhost:3000',
      'https://ys-academy.vercel.app',
      'https://ys-academy-dev.vercel.app',
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

  handleConnection(client: Socket) {
    const { roomId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };

    if (!roomId) {
      void client.disconnect();
      return;
    }

    const roomName = `room-${roomId}`;
    void client.join(roomName);

    // Можно логировать при необходимости
    // console.log(`User ${userId} joined room ${roomId}`);
  }

  handleDisconnect(): void {
    // Здесь можно добавить логику при отключении клиента при необходимости
  }

  // Получаем локальные изменения и рассылаем всем, кроме отправителя
  @SubscribeMessage('update')
  handleUpdate(client: Socket, payload: any) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    client.to(roomName).emit('update', {
      ...payload,
      userId,
    });
  }

  // Инициализация состояния доски (если фронт это использует)
  @SubscribeMessage('init')
  handleInit(client: Socket, payload: any) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    client.to(roomName).emit('init', {
      ...payload,
      userId,
    });
  }

  // Удаление элементов доски (например, блоков/объектов)
  @SubscribeMessage('delete')
  handleDelete(client: Socket, payload: any) {
    const { roomId, userId } = client.handshake.query as {
      roomId?: string;
      userId?: string;
    };
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    // рассылаем всем в комнате, кроме отправителя
    client.to(roomName).emit('delete', {
      ...payload,
      userId,
    });
  }
}
