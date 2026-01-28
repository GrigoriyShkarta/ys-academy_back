// src/board-sync.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BoardService } from './modules/boards/board.service';

@WebSocketGateway()
export class BoardSyncGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly boardService: BoardService) {}

  afterInit() {
    console.log('🚀 BoardSync Gateway initialized');
  }

  // === CONNECTION ===
  async handleConnection(client: Socket) {
    const { roomId, userId, userName } = client.handshake.query as {
      roomId?: string;
      userId?: string;
      userName?: string;
    };

    console.log(
      `🔌 Connection attempt from ${userId} (${userName}) to room ${roomId}`,
    );

    if (!roomId || !userId) {
      console.warn('⚠️ Connection rejected: missing roomId or userId');
      client.disconnect();
      return;
    }

    // Store user data in socket for later use
    client.data = { roomId, userId, userName: userName || 'Anonymous' };

    // Join the room
    const roomName = `room-${roomId}`;
    await client.join(roomName);

    // Send current board state to the new client
    try {
      const records = await this.boardService.getBoardRecords(roomId);

      console.log(`✅ User ${userId} (${userName}) joined room ${roomId}`);
      console.log(`📤 Sending ${records.length} records to ${userId}`);

      client.emit('init', records);
    } catch (error) {
      console.error(`❌ Error loading board for room ${roomId}:`, error);
      client.emit('init', []);
    }

    // Heartbeat для Heroku
    const heartbeat = setInterval(() => {
      if (client.connected) {
        client.emit('ping', { timestamp: Date.now() });
      }
    }, 25000);

    client.data.heartbeat = heartbeat;
  }

  // === DISCONNECTION ===
  handleDisconnect(client: Socket) {
    const { roomId, userId, userName, heartbeat } = client.data || {};

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    if (roomId && userId) {
      const roomName = `room-${roomId}`;
      // Notify other users that this user left
      client.to(roomName).emit('user-left', userId);
      console.log(`👋 User ${userId} (${userName}) left room ${roomId}`);
    }
  }

  @SubscribeMessage('pong')
  handlePong(client: Socket) {
    client.data.lastPong = Date.now();
  }

  // === GET BOARD (explicit request) ===
  @SubscribeMessage('get-board')
  async handleGetBoard(client: Socket, payload: { roomId: string }) {
    const roomId = payload?.roomId || client.data?.roomId;
    if (!roomId) {
      console.warn('⚠️ get-board: no roomId');
      return;
    }

    try {
      const records = await this.boardService.getBoardRecords(roomId);
      client.emit('init', records);
      console.log(
        `📤 get-board: Sent ${records.length} records to ${client.data.userId}`,
      );
    } catch (error) {
      console.error(`❌ Error fetching board ${roomId}:`, error);
      client.emit('init', []);
    }
  }

  // === UPDATE RECORDS ===
  @SubscribeMessage('update')
  async handleUpdate(client: Socket, payload: any) {
    const { roomId, userId } = client.data || {};
    if (!roomId) {
      console.warn('⚠️ update: no roomId in client.data');
      return;
    }

    const roomName = `room-${roomId}`;

    try {
      // Normalize payload to flat array
      let records = Array.isArray(payload) ? payload : [payload];

      // Flatten nested arrays if needed
      if (records.length > 0 && Array.isArray(records[0])) {
        records = records.flat();
      }

      // Filter out invalid records
      records = records.filter((r: any) => r && r.id && r.typeName);

      if (records.length === 0) {
        console.warn('⚠️ update: no valid records');
        return;
      }

      console.log(`📥 Update from ${userId}: ${records.length} records`);

      // Save to database (async, don't block)
      this.boardService.updateBoardRecords(roomId, records).catch((err) => {
        console.error('❌ DB Save Error:', err);
      });

      // Broadcast to all others in the room IMMEDIATELY
      client.to(roomName).emit('update', records);

      console.log(`✅ Broadcast ${records.length} records to room ${roomName}`);
    } catch (error) {
      console.error(`❌ Error updating board ${roomId}:`, error);
    }
  }

  // === DELETE RECORDS ===
  @SubscribeMessage('delete')
  async handleDelete(client: Socket, payload: any) {
    const { roomId, userId } = client.data || {};
    if (!roomId) {
      console.warn('⚠️ delete: no roomId');
      return;
    }

    const roomName = `room-${roomId}`;

    try {
      // Normalize payload to array of IDs
      const recordIds: string[] = Array.isArray(payload) ? payload : [payload];

      if (recordIds.length === 0) {
        console.warn('⚠️ delete: no recordIds');
        return;
      }

      console.log(`🗑️ Delete from ${userId}: ${recordIds.length} records`);

      // Delete from database (async)
      this.boardService.deleteBoardRecords(roomId, recordIds).catch((err) => {
        console.error('❌ DB Delete Error:', err);
      });

      // Broadcast to all others in the room
      client.to(roomName).emit('delete', recordIds);

      console.log(
        `✅ Broadcast delete of ${recordIds.length} records to room ${roomName}`,
      );
    } catch (error) {
      console.error(`❌ Error deleting from board ${roomId}:`, error);
    }
  }

  // === CURSOR MOVEMENT ===
  @SubscribeMessage('cursor')
  handleCursor(
    client: Socket,
    payload: { x: number; y: number; userName?: string },
  ) {
    const { roomId, userId, userName } = client.data || {};
    if (!roomId || !userId) return;

    const roomName = `room-${roomId}`;

    // Broadcast cursor position to all others in the room (volatile = can be dropped)
    client.to(roomName).volatile.emit('cursor', {
      userId,
      userName: payload.userName || userName || 'Anonymous',
      x: payload.x,
      y: payload.y,
    });
  }
}
