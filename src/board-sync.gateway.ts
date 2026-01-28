// src/board-sync.gateway.ts
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
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class BoardSyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly boardService: BoardService) {}

  // === CONNECTION ===
  async handleConnection(client: Socket) {
    const { roomId, userId, userName } = client.handshake.query as {
      roomId?: string;
      userId?: string;
      userName?: string;
    };

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
      client.emit('init', records);
      console.log(
        `✅ User ${userId} (${userName}) joined room ${roomId}, sent ${records.length} records`,
      );
    } catch (error) {
      console.error(`❌ Error loading board for room ${roomId}:`, error);
      client.emit('init', []);
    }
  }

  // === DISCONNECTION ===
  handleDisconnect(client: Socket) {
    const { roomId, userId } = client.data || {};

    if (roomId && userId) {
      const roomName = `room-${roomId}`;
      // Notify other users that this user left
      client.to(roomName).emit('user-left', userId);
      console.log(`👋 User ${userId} left room ${roomId}`);
    }
  }

  // === GET BOARD (explicit request) ===
  @SubscribeMessage('get-board')
  async handleGetBoard(client: Socket, payload: { roomId: string }) {
    const roomId = payload?.roomId || client.data?.roomId;
    if (!roomId) return;

    try {
      const records = await this.boardService.getBoardRecords(roomId);
      client.emit('init', records);
      console.log(`📤 Sent ${records.length} records to client for room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error fetching board ${roomId}:`, error);
      client.emit('init', []);
    }
  }

  // === UPDATE RECORDS ===
  @SubscribeMessage('update')
  async handleUpdate(client: Socket, payload: any) {
    const { roomId, userId } = client.data || {};
    if (!roomId) return;

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

      if (records.length === 0) return;

      console.log(`📥 Update from ${userId}: ${records.length} records`);

      // Save to database
      await this.boardService.updateBoardRecords(roomId, records);

      // Broadcast to all others in the room
      client.to(roomName).emit('update', records);

      console.log(`💾 Saved & broadcast ${records.length} records in room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error updating board ${roomId}:`, error);
    }
  }

  // === DELETE RECORDS ===
  @SubscribeMessage('delete')
  async handleDelete(client: Socket, payload: any) {
    const { roomId, userId } = client.data || {};
    if (!roomId) return;

    const roomName = `room-${roomId}`;

    try {
      // Normalize payload to array of IDs
      const recordIds: string[] = Array.isArray(payload) ? payload : [payload];

      if (recordIds.length === 0) return;

      console.log(`🗑️ Delete from ${userId}: ${recordIds.length} records`);

      // Delete from database
      await this.boardService.deleteBoardRecords(roomId, recordIds);

      // Broadcast to all others in the room
      client.to(roomName).emit('delete', recordIds);

      console.log(`🗑️ Deleted ${recordIds.length} records from room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error deleting from board ${roomId}:`, error);
    }
  }

  // === CURSOR MOVEMENT ===
  @SubscribeMessage('cursor')
  handleCursor(client: Socket, payload: { x: number; y: number; userName?: string }) {
    const { roomId, userId, userName } = client.data || {};
    if (!roomId || !userId) return;

    const roomName = `room-${roomId}`;

    // Broadcast cursor position to all others in the room
    // Include userId so frontend knows whose cursor it is
    client.to(roomName).emit('cursor', {
      userId,
      userName: payload.userName || userName || 'Anonymous',
      x: payload.x,
      y: payload.y,
    });
  }
}
