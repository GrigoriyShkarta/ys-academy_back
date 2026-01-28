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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class BoardSyncGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private saveTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(private readonly boardService: BoardService) {}

  afterInit() {
    console.log('🚀 BoardSync Gateway initialized');
  }

  // === CONNECTION ===
  async handleConnection(client: Socket) {
    const { userId, userName } = client.handshake.query as {
      userId?: string;
      userName?: string;
    };

    client.data = { userId, userName: userName || 'Anonymous' };
    console.log(`🔌 Client connected: ${userId} (${userName})`);

    // Heartbeat for Heroku/Stability
    const heartbeat = setInterval(() => {
      if (client.connected) {
        client.emit('ping', { timestamp: Date.now() });
      }
    }, 25000);

    client.data.heartbeat = heartbeat;
  }

  // === DISCONNECTION ===
  handleDisconnect(client: Socket) {
    const { userId, userName, heartbeat, currentBoardId } = client.data || {};

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    if (currentBoardId && userId) {
      const roomName = `board:${currentBoardId}`;
      client.to(roomName).emit('user-left', userId);
      console.log(`👋 User ${userId} (${userName}) left board ${currentBoardId}`);
    } else {
      console.log(`🔌 Client disconnected: ${userId} (${userName})`);
    }
  }

  @SubscribeMessage('pong')
  handlePong(client: Socket) {
    client.data.lastPong = Date.now();
    console.log(`🏓 Pong from ${client.data.userId}`);
  }

  // === JOIN BOARD ===
  @SubscribeMessage('join-board')
  async handleJoinBoard(client: Socket, boardId: string) {
    if (!boardId) return;

    const roomName = `board:${boardId}`;
    await client.join(roomName);
    client.data.currentBoardId = boardId;

    console.log(`👤 User ${client.data.userId} joined board: ${boardId}`);

    try {
      const board = await this.boardService.getBoard(boardId);
      client.emit('init-board', {
        elements: board.elements,
        appState: board.appState,
        files: board.files,
      });
    } catch (error) {
      console.error(`❌ Error initializing board ${boardId}:`, error);
      client.emit('init-board', { elements: [], appState: {}, files: {} });
    }
  }

  // === UPDATE BOARD ===
  @SubscribeMessage('update-board')
  async handleUpdateBoard(
    client: Socket,
    data: { boardId: string; elements: any[]; appState: any; files: any },
  ) {
    const { boardId, elements, appState, files } = data;
    if (!boardId) return;

    const roomName = `board:${boardId}`;

    console.log(`📥 Update board ${boardId} from ${client.data.userId} (${elements.length} elements)`);

    // Broadcast to others immediately for smooth interaction
    client.to(roomName).emit('board-update', { elements, files });

    // Clear existing timeout for this board
    if (this.saveTimeouts.has(boardId)) {
      clearTimeout(this.saveTimeouts.get(boardId));
    }

    // Set new timeout for debounced saving
    const timeout = setTimeout(async () => {
      try {
        console.log(`💾 Saving board ${boardId} to database...`);
        await this.boardService.updateBoard(boardId, elements, appState, files);
        console.log(`✅ Board ${boardId} saved successfully`);
        this.saveTimeouts.delete(boardId);
      } catch (error) {
        console.error(`❌ Error saving board ${boardId}:`, error);
      }
    }, 2000); // 2 seconds debounce

    this.saveTimeouts.set(boardId, timeout);
  }

  // === POINTER MOVE ===
  @SubscribeMessage('pointer-move')
  handlePointerMove(
    client: Socket,
    data: {
      boardId: string;
      userId: number;
      userName: string;
      pointer: { x: number; y: number };
    },
  ) {
    const { boardId, userId, userName, pointer } = data;
    if (!boardId) return;

    const roomName = `board:${boardId}`;

    console.log(`🖱️ Pointer move: ${userName} (${userId}) at ${pointer.x}, ${pointer.y}`);

    // Broadcast cursor position (volatile for performance)
    client.to(roomName).volatile.emit('pointer-move', {
      userId,
      userName,
      pointer,
    });
  }
}
