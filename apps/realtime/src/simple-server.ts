import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Chess } from 'chess.js';
import { getGamePersistenceService } from './services/game-persistence';
import { getOpeningDetector } from './services/opening-detector';
import { getTournamentManager } from './services/tournament-manager';
import { getRandomChess960Position } from '@chess960/utils';
import { RedisClient } from '@chess960/redis-client';
import { RedisPubSub } from './services/redis-pubsub';
// Push notifications removed for game events to avoid spam

// Simple types
interface User {
  id: string;
  handle: string;
  email?: string;
}

interface ClientConnection {
  ws: WebSocket;
  user: User | null;
  sessionId: string | null;
  currentGameId: string | null;
  connectedAt: number;
  lastPing: number;
  subscribedTeamTournaments: Set<string>; // Track team tournament subscriptions
  spectatingGames: Set<string>; // Track games being spectated
}

interface QueueEntry {
  userId: string;
  connection: ClientConnection;
  tc: string;
  rated: boolean;
  rating: number;
  rd: number;
  joinedAt: number;
}

// Simple message types
type ClientMessage = any;
type ServerMessage = any;
type WelcomeMessage = any;
type QueueJoinedMessage = any;
type MatchFoundMessage = any;
type ErrorMessage = any;

// Simple validation
function validateClientMessage(message: any): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }
  if (!message.t || typeof message.t !== 'string') {
    return { valid: false, error: 'Missing message type' };
  }
  return { valid: true };
}

// Simple rate limiting
function createRateLimitInfo() {
  return {
    messageCount: 0,
    lastReset: Date.now(),
    isLimited: false
  };
}

// Simple game manager
class GameManager {
  private games = new Map<string, any>();

  createGame(whiteId: string, blackId: string, tc: string, rated: boolean): string {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[GAME] Creating game:', gameId, 'white:', whiteId, 'black:', blackId, 'tc:', tc);
    const now = Date.now();

    // Generate Chess960 position
    const chess960Position = getRandomChess960Position();
    console.log(`[CHESS960] Generated position ${chess960Position.position} for game ${gameId}`);
    console.log(`[CHESS960] FEN: ${chess960Position.fen}`);

    // Determine initial time based on time control
    const initialTime = tc === '2+0' ? 120000 : 60000; // 2 minutes for 2+0, 1 minute for 1+0

    this.games.set(gameId, {
      id: gameId,
      whiteId,
      blackId,
      tc,
      rated,
      startedAt: new Date(),
      status: 'active',
      moves: [],
      timeLeft: { w: initialTime, b: initialTime },
      toMove: 'white',
      moveStartTime: null, // Don't start timer until after both first moves
      lastMoveTime: null,
      firstMoveDeadline: now + 15000, // 15 seconds for white's first move
      waitingForFirstMove: true,
      waitingForSecondMove: false, // Track if waiting for black's first move
      timeoutId: null, // Timer for checking time forfeit
      rematchOffer: null, // Track rematch offers
      chatMessages: [], // Track chat messages
      chess960Position: chess960Position.position, // Store position number (1-960)
      initialFen: chess960Position.fen, // Store initial FEN
    });
    return gameId;
  }

  getGame(gameId: string) {
    return this.games.get(gameId);
  }

  getAllGames() {
    return Array.from(this.games.values());
  }

  deleteGame(gameId: string) {
    const game = this.games.get(gameId);
    if (game?.timeoutId) {
      clearTimeout(game.timeoutId);
    }
    this.games.delete(gameId);
  }

  scheduleTimeForfeitCheck(gameId: string, broadcastEndFn: (gameId: string, result: string, reason: string) => void) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Clear any existing timeout
    if (game.timeoutId) {
      clearTimeout(game.timeoutId);
      game.timeoutId = null;
    }

    // Don't schedule if game has ended
    if (game.ended) {
      return;
    }

    // Don't check time if waiting for first or second move (handled by firstMoveTimeoutChecker)
    if (game.waitingForFirstMove || game.waitingForSecondMove) {
      return;
    }

    // Calculate time until current player runs out
    const now = Date.now();
    const timeElapsed = game.moveStartTime ? now - game.moveStartTime : 0;
    const currentPlayerColor = game.toMove;
    const colorKey = currentPlayerColor === 'white' ? 'w' : 'b';
    const currentPlayerTime = game.timeLeft[colorKey];
    const timeRemaining = currentPlayerTime - timeElapsed;

    // If already out of time, end the game immediately
    if (timeRemaining <= 0) {
      console.log(`[TIMEOUT] Time forfeit detected for ${currentPlayerColor} in game ${gameId}`);
      const result = currentPlayerColor === 'white' ? 'flag-white' : 'flag-black';
      broadcastEndFn(gameId, result, 'time forfeit');
      return;
    }

    // Set timeout to check when time expires (plus 100ms buffer for timing precision)
    game.timeoutId = setTimeout(() => {
      // Double-check time hasn't expired
      const checkNow = Date.now();
      const checkTimeElapsed = game.moveStartTime ? checkNow - game.moveStartTime : 0;
      const checkTimeRemaining = game.timeLeft[colorKey] - checkTimeElapsed;

      if (checkTimeRemaining <= 0 && !game.ended) {
        console.log(`[TIMEOUT] Time forfeit triggered for ${currentPlayerColor} in game ${gameId}`);
        const result = currentPlayerColor === 'white' ? 'flag-white' : 'flag-black';
        broadcastEndFn(gameId, result, 'time forfeit');
      }
    }, timeRemaining + 100);
  }
}

// Simple matchmaking queue
class MatchmakingQueue {
  private queues = new Map<string, QueueEntry[]>();

  addPlayer(entry: QueueEntry): boolean {
    const queueKey = `${entry.tc}_${entry.rated}`;
    if (!this.queues.has(queueKey)) {
      this.queues.set(queueKey, []);
    }

    const queue = this.queues.get(queueKey)!;

    // Check if player is already in queue (prevents multiple devices)
    if (queue.some(e => e.userId === entry.userId)) {
      console.log(`[WARN] User ${entry.userId} already in queue for ${queueKey}`);
      return false;
    }

    queue.push(entry);
    console.log(`[OK] Added user ${entry.userId} to queue ${queueKey}. Queue size: ${queue.length}`);
    return true;
  }

  removePlayer(userId: string): boolean {
    for (const [key, queue] of this.queues) {
      const index = queue.findIndex(e => e.userId === userId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  findMatch(tc: string, rated: boolean): QueueEntry[] | null {
    const queueKey = `${tc}_${rated}`;
    const queue = this.queues.get(queueKey) || [];

    // Only log when there are players in the queue to reduce noise
    if (queue.length > 0) {
      console.log(`[DEBUG] Looking for match in ${queueKey}. Queue size: ${queue.length}`);
    }

    if (queue.length >= 2) {
      const player1 = queue.shift()!;
      const player2 = queue.shift()!;
      console.log(`[MATCH] Found match! ${player1.userId} vs ${player2.userId}`);
      return [player1, player2];
    }

    return null;
  }

  getEstimatedWaitTime(tc: string, rated: boolean, rating: number): number {
    return 5000; // 5 seconds estimate
  }
}

export class SimpleRealtimeServer {
  private server = createServer((req, res) => {
    // Add CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Handle HTTP health check requests
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: 'simple-2025-08-30',
        connections: this.connections.size,
      }));
    } else if (req.url === '/stats') {
      const activeGames = this.gameManager.getAllGames().filter(game => game.status === 'active').length;
      const stats = this.redisPubSub.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        playersOnline: stats.playersOnline,
        gamesInProgress: activeGames,
        timestamp: new Date().toISOString(),
      }));
    } else if (req.url === '/maintenance') {
      // Check if server is in maintenance mode
      const isMaintenanceMode = this.isMaintenanceMode();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        maintenance: isMaintenanceMode,
        message: isMaintenanceMode ? 'Server is in maintenance mode. Games are disabled.' : 'Server is operational.',
        timestamp: new Date().toISOString(),
      }));
    } else if (req.url === '/api/broadcast/typing' && req.method === 'POST') {
      // Handle typing indicator broadcast
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { senderId, senderHandle, receiverId } = data;

          if (!senderId || !receiverId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing senderId or receiverId' }));
            return;
          }

          // Find receiver's WebSocket connection and broadcast typing event
          for (const [ws, connection] of this.connections.entries()) {
            if (connection.user?.id === receiverId) {
              this.sendMessage(connection, {
                t: 'message.typing',
                userId: senderId,
                handle: senderHandle,
              });
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error('Error broadcasting typing event:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to broadcast typing event' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  private healthServer = createServer((req, res) => {
    // Health check endpoint for port 8081
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: 'simple-2025-08-30',
        connections: this.connections.size,
      }));
    } else if (req.url === '/stats') {
      const activeGames = this.gameManager.getAllGames().filter(game => game.status === 'active').length;
      const stats = this.redisPubSub.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        playersOnline: stats.playersOnline,
        gamesInProgress: activeGames,
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  private wss = new WebSocketServer({ 
    server: this.server,
    verifyClient: (info: any) => {
      console.log('[DEBUG] WebSocket connection attempt from:', info.origin);
      return true;
    }
  });

  private connections = new Map<WebSocket, ClientConnection>();
  private gameManager = new GameManager();
  private matchmakingQueue = new MatchmakingQueue();
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private firstMoveTimeoutInterval: NodeJS.Timeout | null = null;
  private persistenceService = getGamePersistenceService();
  private openingDetector = getOpeningDetector();
  private tournamentManager = getTournamentManager();
  private prisma: any = null;
  private redisSubscriber: RedisClient;
  private redisPubSub: RedisPubSub;

  private async getPrismaClient() {
    try {
      const { prisma } = await import('@chess960/db');
      return prisma;
    } catch (error) {
      console.error('[ERR] Failed to load Prisma client:', error);
      return null;
    }
  }

  // Update user's last activity timestamp
  private async updateUserActivity(userId: string) {
    if (!this.prisma || userId.startsWith('guest_')) return; // Skip for guest users

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActivityAt: new Date() }
      });
    } catch (error) {
      // Silently fail - this is not critical
      console.debug('[DEBUG] Failed to update user activity:', error);
    }
  }

  constructor(private port: number = 8080) {
    this.setupWebSocketServer();
    this.startMatchmaking();
    this.startFirstMoveTimeoutChecker();

    // Wire up tournament broadcast function
    this.tournamentManager.setBroadcastFunction(this.broadcastToTournamentPlayers);

    // Set up Redis subscriber for team tournament events
    this.redisSubscriber = RedisClient.getInstance();
    this.setupTeamTournamentSubscriptions();

    // Initialize Redis pub/sub for user tracking
    this.redisPubSub = new RedisPubSub();

    // Initialize Prisma client
    this.initializePrisma();
  }

  // Check if server is in maintenance mode
  private isMaintenanceMode(): boolean {
    // In production, disable games. In development (localhost), allow games.
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = process.env.PORT === undefined || process.env.PORT === '8080';
    
    // Enable maintenance mode in production, disable in localhost
    return isProduction && !isLocalhost;
  }

  private async initializePrisma() {
    this.prisma = await this.getPrismaClient();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('[CONN] New WebSocket connection established');

      // Check if server is in maintenance mode
      if (this.isMaintenanceMode()) {
        console.log('[MAINTENANCE] Rejecting WebSocket connection - server in maintenance mode');
        ws.close(1000, 'Server is in maintenance mode. Games are temporarily disabled.');
        return;
      }

      const connection: ClientConnection = {
        ws,
        user: null,
        sessionId: null,
        currentGameId: null,
        connectedAt: Date.now(),
        lastPing: Date.now(),
        subscribedTeamTournaments: new Set<string>(),
        spectatingGames: new Set<string>(),
      };

      this.connections.set(ws, connection);

      ws.on('message', async (data: Buffer) => {
        await this.handleMessage(connection, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(connection);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(connection);
      });

      // Don't send welcome here - wait for hello handshake which includes user info
    });
  }

  private async handleMessage(connection: ClientConnection, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      console.log('[MSG] Received message type:', message.t, 'from user:', connection.user?.handle || 'unauthenticated', 'userId:', connection.user?.id);

      const validationResult = validateClientMessage(message);

      if (!validationResult.valid) {
        console.error('[ERR] Invalid message:', validationResult.error, 'message:', JSON.stringify(message));
        this.sendError(connection, 'INVALID_MESSAGE', validationResult.error || 'Invalid message');
        return;
      }

      await this.processMessage(connection, message as ClientMessage);
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(connection, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  private async processMessage(connection: ClientConnection, message: ClientMessage) {
    switch (message.t) {
      case 'hello':
        await this.handleHello(connection, message);
        break;
      case 'auth':
        await this.handleAuth(connection, message);
        break;
      case 'queue.join':
        await this.handleQueueJoin(connection, message);
        break;
      case 'queue.leave':
        this.handleQueueLeave(connection);
        break;
      case 'ping':
        // Handle ping/pong for heartbeat
        this.sendMessage(connection, { t: 'pong', now: Date.now() });
        break;
      case 'game.move':
      case 'move.make':
        await this.handleGameMove(connection, message);
        break;
      case 'resign':
      case 'game.resign':
        await this.handleGameResign(connection, message);
        break;
      case 'abort':
      case 'game.abort':
        await this.handleGameAbort(connection, message);
        break;
      case 'draw.offer':
      case 'game.draw.offer':
        await this.handleDrawOffer(connection, message);
        break;
      case 'draw.accept':
      case 'game.draw.accept':
        await this.handleDrawAccept(connection, message);
        break;
      case 'draw.decline':
      case 'game.draw.decline':
        await this.handleDrawDecline(connection, message);
        break;
      case 'rematch.offer':
        await this.handleRematchOffer(connection, message);
        break;
      case 'rematch.accept':
        await this.handleRematchAccept(connection, message);
        break;
      case 'rematch.decline':
        await this.handleRematchDecline(connection, message);
        break;
      case 'chat.message':
        await this.handleChatMessage(connection, message);
        break;
      case 'tournament.chat.message':
        await this.handleTournamentChatMessage(connection, message);
        break;
      case 'team-tournament.subscribe':
        await this.handleTeamTournamentSubscribe(connection, message);
        break;
      case 'team-tournament.unsubscribe':
        await this.handleTeamTournamentUnsubscribe(connection, message);
        break;
      case 'game.spectate':
        await this.handleGameSpectate(connection, message);
        break;
      case 'game.unspectate':
        await this.handleGameUnspectate(connection, message);
        break;
      default:
        this.sendError(connection, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.t}`);
    }
  }

  private async handleHello(connection: ClientConnection, message: any) {
    try {
      console.log('[HELLO] Hello message received with sessionId:', message.sessionId?.substring(0, 20) + '...');

      // Validate session token and get user
      const user = await this.validateSession(message.sessionId);

      if (!user) {
        this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
        return;
      }

      connection.user = user;
      connection.sessionId = message.sessionId;

      console.log('[OK] User authenticated via hello:', user.handle);

      // Publish user connection to Redis
      await this.redisPubSub.publishUserConnect(user.id, user.handle);

      // Update user activity
      this.updateUserActivity(user.id);

      // Send welcome response
      this.sendMessage(connection, {
        t: 'welcome',
        userId: user.id,
        handle: user.handle,
      });
    } catch (error) {
      console.error('Error in handleHello:', error);
      this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
    }
  }

  private async handleAuth(connection: ClientConnection, message: any) {
    console.log('[AUTH] Auth request received:', message);
    // Simple authentication - just create a mock user
    const user: User = {
      id: `Guest${Math.random().toString(36).substr(2, 6)}`,
      handle: message.handle || `Guest${Math.random().toString(36).substr(2, 6)}`,
      email: message.email
    };

    connection.user = user;
    connection.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[OK] User authenticated:', user.handle);

    // Publish user connection to Redis
    await this.redisPubSub.publishUserConnect(user.id, user.handle);

    this.sendMessage(connection, {
      t: 'auth.success',
      user: {
        id: user.id,
        handle: user.handle,
        email: user.email
      },
      sessionId: connection.sessionId
    });
  }

  private async handleQueueJoin(connection: ClientConnection, message: any) {
    console.log('[MATCH] Server: Queue join request from', connection.user?.handle, 'for', message.tc);

    if (!connection.user) {
      this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    // Check if server is in maintenance mode
    if (this.isMaintenanceMode()) {
      this.sendError(connection, 'MAINTENANCE_MODE', 'Server is in maintenance mode. Games are temporarily disabled.');
      return;
    }

    // Update user activity
    await this.updateUserActivity(connection.user.id);

    // Use default rating values
    const userRating = 1500;
    const userRd = 350;

    // Create queue entry
    const queueEntry: QueueEntry = {
      userId: connection.user.id,
      connection,
      tc: message.tc || '1+0',
      rated: message.rated !== false,
      rating: userRating,
      rd: userRd,
      joinedAt: Date.now(),
    };

    // Add to queue
    if (this.matchmakingQueue.addPlayer(queueEntry)) {
      const estimatedWait = this.matchmakingQueue.getEstimatedWaitTime(
        message.tc,
        message.rated,
        userRating
      );

      console.log('[OK] Server: User', connection.user.handle, 'joined queue for', message.tc);
      this.sendMessage(connection, {
        t: 'queue.joined',
        tc: message.tc,
        rated: message.rated,
        estimatedWait,
      });
    } else {
      console.warn('[WARN] Server: User', connection.user.handle, 'failed to join queue - already in queue');
      this.sendError(connection, 'ALREADY_IN_QUEUE', 'Already in queue');
    }
  }

  private handleQueueLeave(connection: ClientConnection) {
    if (!connection.user) {
      this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    if (this.matchmakingQueue.removePlayer(connection.user.id)) {
      this.sendMessage(connection, { t: 'queue.left' });
    } else {
      this.sendError(connection, 'NOT_IN_QUEUE', 'Not in queue');
    }
  }

  private handleDisconnection(connection: ClientConnection) {
    console.log('[DISC] WebSocket connection closed');
    
    if (connection.user) {
      // Publish user disconnection to Redis
      this.redisPubSub.publishUserDisconnect(connection.user.id);
      
      // Clean up spectator subscriptions
      connection.spectatingGames.forEach((gameId) => {
        console.log(`[SPECTATE] User ${connection.user!.handle} disconnected, removed from spectating game ${gameId}`);
      });
      
      // Add a grace period before removing from queue to allow for reconnections
      setTimeout(() => {
        this.matchmakingQueue.removePlayer(connection.user!.id);
        console.log(`[CLEANUP] Removed user ${connection.user!.handle} from any queues`);
      }, 5000); // 5 second grace period
    }
    
    this.connections.delete(connection.ws);
  }

  private startMatchmaking() {
    this.matchmakingInterval = setInterval(() => {
      // Check for matches in all queues
      const timeControls = ['1+0', '2+0'];
      const ratedOptions = [true, false];

      let matchesFound = 0;

      for (const tc of timeControls) {
        for (const rated of ratedOptions) {
          const match = this.matchmakingQueue.findMatch(tc, rated);
          if (match) {
            console.log(`[MATCH] Match found! ${match[0].userId} vs ${match[1].userId} (${tc}, ${rated ? 'rated' : 'casual'})`);
            matchesFound++;
            this.handleMatchFound(match[0], match[1]);
          }
        }
      }
    }, 100); // Check every 100ms for faster matching
  }

  private startFirstMoveTimeoutChecker() {
    this.firstMoveTimeoutInterval = setInterval(async () => {
      const now = Date.now();
      const games = this.gameManager.getAllGames();

      for (const game of games) {
        // Check if game is waiting for first move and deadline has passed
        if (game.waitingForFirstMove && game.firstMoveDeadline && now > game.firstMoveDeadline) {
          console.log(`[TIMEOUT] First move timeout in game ${game.id} - aborting game`);

          // Abort the game
          game.ended = true;
          game.result = 'timeout-start';
          game.endedAt = Date.now();

          // Broadcast timeout to both players
          this.broadcastToGame(game.id, {
            t: 'game.end',
            gameId: game.id,
            result: 'timeout-start',
            reason: 'White did not make first move within 15 seconds'
          });

          // Clear game references
          for (const [ws, connection] of this.connections.entries()) {
            if (connection.currentGameId === game.id) {
              connection.currentGameId = null;
            }
          }

          // Delete the game
          this.gameManager.deleteGame(game.id);
        }

        // Check if game is waiting for second move and deadline has passed
        if (game.waitingForSecondMove && game.firstMoveDeadline && now > game.firstMoveDeadline) {
          console.log(`[TIMEOUT] Second move timeout in game ${game.id} - aborting game`);

          // Abort the game
          game.ended = true;
          game.result = 'timeout-start';
          game.endedAt = Date.now();

          // Broadcast timeout to both players
          this.broadcastToGame(game.id, {
            t: 'game.end',
            gameId: game.id,
            result: 'timeout-start',
            reason: 'Black did not make first move within 15 seconds'
          });

          // Clear game references
          for (const [ws, connection] of this.connections.entries()) {
            if (connection.currentGameId === game.id) {
              connection.currentGameId = null;
            }
          }

          // Delete the game
          this.gameManager.deleteGame(game.id);
        }
      }
    }, 1000); // Check every second
  }

  private handleMatchFound(player1: QueueEntry, player2: QueueEntry) {
    const gameId = this.gameManager.createGame(
      player1.userId,
      player2.userId,
      player1.tc,
      player1.rated
    );

    const game = this.gameManager.getGame(gameId);
    const increment = 0; // Both 1+0 and 2+0 have no increment
    const initialTime = player1.tc === '2+0' ? 120000 : 60000; // 2 minutes for 2+0, 1 minute for 1+0

    // Send match found message to both players with different colors
    const whiteMessage = {
      t: 'match.found',
      gameId,
      color: 'white',
      opponent: {
        handle: player2.connection.user?.handle || 'Anonymous',
        rating: player2.rating,
        rd: 150
      },
      moves: game.moves,
      timeLeft: game.timeLeft,
      toMove: game.toMove,
      increment: increment,
      ended: false,
      initial: {
        w: initialTime,
        b: initialTime,
        inc: increment * 1000 // Convert to ms
      },
      serverStartAt: Date.now(),
      initialFen: game.initialFen, // Chess960 starting position FEN
      chess960Position: game.chess960Position, // Position number (1-960)
    };

    const blackMessage = {
      t: 'match.found',
      gameId,
      color: 'black',
      opponent: {
        handle: player1.connection.user?.handle || 'Anonymous',
        rating: player1.rating,
        rd: 150
      },
      moves: game.moves,
      timeLeft: game.timeLeft,
      toMove: game.toMove,
      increment: increment,
      ended: false,
      initial: {
        w: initialTime,
        b: initialTime,
        inc: increment * 1000 // Convert to ms
      },
      serverStartAt: Date.now(),
      initialFen: game.initialFen, // Chess960 starting position FEN
      chess960Position: game.chess960Position, // Position number (1-960)
    };

    console.log('[MATCH] Sending WHITE message to player1:', player1.userId, 'with color:', whiteMessage.color);
    this.sendMessage(player1.connection, whiteMessage);

    console.log('[MATCH] Sending BLACK message to player2:', player2.userId, 'with color:', blackMessage.color);
    this.sendMessage(player2.connection, blackMessage);

    // Set current game for both connections
    player1.connection.currentGameId = gameId;
    player2.connection.currentGameId = gameId;

    // Persist game start to database (for live games list)
    this.persistGameStart(game).catch((error) => {
      console.error('[ERR] Failed to persist game start:', error);
    });
  }

  private sendMessage(connection: ClientConnection, message: ServerMessage) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  private sendError(connection: ClientConnection, code: string, message: string) {
    const errorMessage: ErrorMessage = {
      t: 'error',
      code,
      message
    };
    this.sendMessage(connection, errorMessage);
  }

  public start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[SERVER] Realtime Server listening on port ${this.port}`);
    });

    // Start health check server on port 8081
    this.healthServer.listen(this.port + 1, '0.0.0.0', () => {
      console.log(`[SERVER] Health check server listening on port ${this.port + 1}`);
    });
  }

  // Game action handlers
  private async handleGameMove(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    // Support both 'move' and 'uci' fields
    const move = message.move || message.uci;
    const moveTime = message.moveTime || message.clientTs || Date.now();

    if (!gameId || !move) {
      console.error('[ERR] Missing gameId or move:', { gameId, move, message });
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId or move');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      console.error('[ERR] Game not found:', gameId);
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Validate it's the player's turn
    const isWhitePlayer = connection.user.id === game.whiteId;
    const isBlackPlayer = connection.user.id === game.blackId;

    if (!isWhitePlayer && !isBlackPlayer) {
      console.error('[ERR] Not in game:', connection.user.id, 'whiteId:', game.whiteId, 'blackId:', game.blackId);
      this.sendError(connection, 'NOT_IN_GAME', 'Not a player in this game');
      return;
    }

    // Simple turn validation - could be enhanced with chess.js
    const moveCount = game.moves ? game.moves.length : 0;
    const isWhiteTurn = moveCount % 2 === 0;

    if ((isWhiteTurn && !isWhitePlayer) || (!isWhiteTurn && !isBlackPlayer)) {
      console.error('[ERR] Not your turn:', {
        isWhiteTurn,
        isWhitePlayer,
        isBlackPlayer,
        moveCount
      });
      this.sendError(connection, 'NOT_YOUR_TURN', 'Not your turn');
      return;
    }

    console.log(`[OK] Valid move from ${connection.user.handle}: ${move} in game ${gameId}`);

    // Update user activity
    this.updateUserActivity(connection.user.id);

    // Validate move with chess.js and check for game end conditions
    // Initialize with Chess960 FEN if present
    const chess = new Chess(game.initialFen);
    // Replay all existing moves
    for (const existingMove of game.moves || []) {
      const from = existingMove.slice(0, 2);
      const to = existingMove.slice(2, 4);
      const promotion = existingMove.length > 4 ? existingMove[4] : undefined;
      chess.move({ from, to, promotion });
    }

    // Validate the new move
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move[4] : undefined;

    try {
      const validatedMove = chess.move({ from, to, promotion });
      if (!validatedMove) {
        console.error('[ERR] Invalid move:', move);
        this.sendError(connection, 'INVALID_MOVE', 'Illegal move');
        return;
      }
    } catch (error) {
      console.error('[ERR] Invalid move:', move, error);
      this.sendError(connection, 'INVALID_MOVE', 'Illegal move');
      return;
    }

    // Update game state
    if (!game.moves) game.moves = [];

    const isFirstMove = game.moves.length === 0;
    const isSecondMove = game.moves.length === 1;
    game.moves.push(move);
    game.lastMoveTime = moveTime;

    // Handle first move (white) - transition to waiting for second move
    if (isFirstMove) {
      game.waitingForFirstMove = false;
      game.waitingForSecondMove = true;
      game.firstMoveDeadline = moveTime + 15000; // 15 seconds for black's first move
      console.log(`[OK] White's first move made in game ${gameId} - black has 15 seconds`);
    }

    // Handle second move (black) - start the normal clock
    if (isSecondMove) {
      game.waitingForSecondMove = false;
      game.firstMoveDeadline = null; // Clear deadline
      console.log(`[OK] Black's first move made in game ${gameId} - starting main clock`);
    }

    // Calculate time left after move (no increment for 1+0 or 2+0)
    const increment = 0; // Both 1+0 and 2+0 have no increment
    const currentPlayerColor = isWhitePlayer ? 'white' : 'black';
    const nextPlayerColor = isWhitePlayer ? 'black' : 'white';

    // Initialize time if not set (should already be set in createGame)
    if (!game.timeLeft) {
      const initialTime = game.tc === '2+0' ? 120000 : 60000;
      game.timeLeft = { w: initialTime, b: initialTime };
    }

    // Update time for current player (subtract elapsed time, add increment)
    // Only deduct time after both players have made their first move
    if (game.moveStartTime !== null && !game.waitingForFirstMove && !game.waitingForSecondMove) {
      const timeSpent = moveTime - game.moveStartTime;
      const colorKey = currentPlayerColor === 'white' ? 'w' : 'b';
      game.timeLeft[colorKey] = Math.max(0, game.timeLeft[colorKey] - timeSpent + increment);
      console.log(`[TIME] ${currentPlayerColor} spent ${timeSpent}ms, remaining: ${game.timeLeft[colorKey]}ms`);

      // CRITICAL: Update moveStartTime after EVERY move (not just the second move!)
      // This ensures the next player's time is calculated correctly
      game.moveStartTime = moveTime;
      console.log(`[TIME] Clock restarted for ${nextPlayerColor} at ${moveTime}`);
    } else {
      console.log(`[TIME] Pre-game phase - no time deducted yet`);
    }

    // Set initial moveStartTime only after second move (when normal clock starts)
    if (isSecondMove) {
      game.moveStartTime = moveTime; // Start clock after black's first move
      console.log(`[TIME] Normal clock started at ${moveTime}`);
    }
    game.toMove = nextPlayerColor;

    // Detect opening after move is added
    const opening = this.openingDetector.detectOpening(game.moves);
    if (opening && (!game.opening || game.opening.name !== opening.name)) {
      game.opening = opening;
      console.log(`[OPENING] Opening detected: ${opening.name} (${opening.eco})`);
    }

    // Broadcast move to both players
    const moveMessage = {
      t: 'move.made',
      gameId,
      uci: move,
      by: currentPlayerColor,
      serverTs: moveTime,
      seq: game.moves.length,
      timeLeft: game.timeLeft,
      opening: game.opening, // Include opening info in move message
    };

    console.log('[SEND] Broadcasting move:', moveMessage);
    this.broadcastToGame(gameId, moveMessage);

    // Note: Move-by-move push notifications removed to avoid spam
    // Users can check the game when they're ready to play

    // Check for game end conditions (checkmate, stalemate, draw)
    if (chess.isCheckmate()) {
      const losingColor = chess.turn() === 'w' ? 'white' : 'black';
      const result = losingColor === 'white' ? 'checkmate-white' : 'checkmate-black';
      console.log(`[CHECKMATE] Game ${gameId} ended by checkmate - ${losingColor} lost`);
      await this.endGame(gameId, result, 'Checkmate');
      return;
    }

    if (chess.isStalemate()) {
      console.log(`[STALEMATE] Game ${gameId} ended by stalemate`);
      await this.endGame(gameId, 'draw', 'Stalemate');
      return;
    }

    if (chess.isThreefoldRepetition()) {
      console.log(`[DRAW] Game ${gameId} ended by threefold repetition`);
      await this.endGame(gameId, 'draw', 'Threefold repetition');
      return;
    }

    if (chess.isInsufficientMaterial()) {
      console.log(`[DRAW] Game ${gameId} ended by insufficient material`);
      await this.endGame(gameId, 'draw', 'Insufficient material');
      return;
    }

    if (chess.isDraw()) {
      console.log(`[DRAW] Game ${gameId} ended by 50-move rule`);
      await this.endGame(gameId, 'draw', '50-move rule');
      return;
    }

    // Schedule time forfeit check for the next player
    this.gameManager.scheduleTimeForfeitCheck(gameId, this.endGame);

    // Update connection game tracking
    connection.currentGameId = gameId;
  }

  private async handleGameResign(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Determine who won
    const isWhitePlayer = connection.user.id === game.whiteId;
    const result = isWhitePlayer ? 'resign-white' : 'resign-black';

    console.log(`[RESIGN] ${connection.user.handle} resigned from game ${gameId}, result: ${result}`);

    // End the game using helper method
    await this.endGame(gameId, result, 'resignation');
  }

  private async handleGameAbort(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Check if abort is allowed (first 2 moves)
    const moveCount = game.moves ? game.moves.length : 0;
    if (moveCount > 2) {
      this.sendError(connection, 'CANNOT_ABORT', 'Cannot abort after move 2');
      return;
    }

    console.log(`[ERR] ${connection.user.handle} aborted game ${gameId}`);

    // End the game using helper method
    await this.endGame(gameId, 'abort', 'Game aborted');
  }

  private async handleDrawOffer(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    console.log(`[DRAW] ${connection.user.handle} offered draw in game ${gameId}`);
    
    // Broadcast draw offer to opponent
    this.broadcastToGame(gameId, {
      t: 'draw.offered',
      gameId,
      by: connection.user.id
    }, connection.user.id); // Exclude the sender
  }

  private async handleDrawAccept(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    console.log(`[OK] ${connection.user.handle} accepted draw in game ${gameId}`);

    const game = this.gameManager.getGame(gameId);
    if (game) {
      // End the game using helper method
      await this.endGame(gameId, 'draw', 'Draw by agreement');
    }
  }

  private async handleDrawDecline(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    console.log(`[ERR] ${connection.user.handle} declined draw in game ${gameId}`);

    // Broadcast draw declined
    this.broadcastToGame(gameId, {
      t: 'draw.declined',
      gameId,
      by: connection.user.id
    });
  }

  private async handleRematchOffer(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Determine player color
    const isWhitePlayer = connection.user.id === game.whiteId;
    const playerColor = isWhitePlayer ? 'white' : 'black';

    console.log(`[REMATCH] ${connection.user.handle} offered rematch in game ${gameId}`);

    // Store rematch offer in game state
    game.rematchOffer = playerColor;

    // Broadcast rematch offer to both players
    this.broadcastToGame(gameId, {
      t: 'rematch.offered',
      gameId,
      by: playerColor
    });
  }

  private async handleRematchAccept(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    const oldGame = this.gameManager.getGame(gameId);
    if (!oldGame) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    console.log(`[OK] ${connection.user.handle} accepted rematch in game ${gameId}`);

    // Create new game with swapped colors
    const newGameId = this.gameManager.createGame(
      oldGame.blackId, // Swap: old black becomes new white
      oldGame.whiteId, // Swap: old white becomes new black
      oldGame.tc,
      oldGame.rated
    );

    const newGame = this.gameManager.getGame(newGameId);
    const increment = 0; // Both 1+0 and 2+0 have no increment
    const initialTime = oldGame.tc === '2+0' ? 120000 : 60000; // 2 minutes for 2+0, 1 minute for 1+0

    // Find connections for both players
    let whiteConnection: ClientConnection | null = null;
    let blackConnection: ClientConnection | null = null;

    for (const [ws, conn] of this.connections.entries()) {
      if (conn.user?.id === newGame.whiteId) {
        whiteConnection = conn;
      } else if (conn.user?.id === newGame.blackId) {
        blackConnection = conn;
      }
    }

    // Send rematch.accepted message to both players with their new colors
    if (whiteConnection) {
      whiteConnection.currentGameId = newGameId;
      this.sendMessage(whiteConnection, {
        t: 'rematch.accepted',
        gameId: gameId,
        newGameId: newGameId,
        color: 'white',
        opponent: {
          handle: blackConnection?.user?.handle || 'Anonymous',
          rating: 1500,
          rd: 150
        },
        initial: {
          w: initialTime,
          b: initialTime,
          inc: increment * 1000
        },
        serverStartAt: Date.now(),
        initialFen: newGame.initialFen, // Chess960 starting position FEN
        chess960Position: newGame.chess960Position, // Position number (1-960)
      });
    }

    if (blackConnection) {
      blackConnection.currentGameId = newGameId;
      this.sendMessage(blackConnection, {
        t: 'rematch.accepted',
        gameId: gameId,
        newGameId: newGameId,
        color: 'black',
        opponent: {
          handle: whiteConnection?.user?.handle || 'Anonymous',
          rating: 1500,
          rd: 150
        },
        initial: {
          w: initialTime,
          b: initialTime,
          inc: increment * 1000
        },
        serverStartAt: Date.now(),
        initialFen: newGame.initialFen, // Chess960 starting position FEN
        chess960Position: newGame.chess960Position, // Position number (1-960)
      });
    }

    console.log(`[REMATCH] Created new game ${newGameId} from rematch of ${gameId}`);
    
    // Persist rematch game start to database (for live games list)
    this.persistGameStart(newGame).catch((error) => {
      console.error('[ERR] Failed to persist rematch game start:', error);
    });
  }

  private async handleRematchDecline(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    console.log(`[REMATCH] ${connection.user.handle} declined rematch in game ${gameId}`);

    // Clear rematch offer
    game.rematchOffer = null;

    // Determine player color
    const isWhitePlayer = connection.user.id === game.whiteId;
    const playerColor = isWhitePlayer ? 'white' : 'black';

    // Broadcast rematch declined to both players
    this.broadcastToGame(gameId, {
      t: 'rematch.declined',
      gameId,
      by: playerColor
    });
  }

  private async handleChatMessage(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const gameId = message.gameId;
    const chatMessage = message.message;

    if (!gameId || !chatMessage) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing gameId or message');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Verify player is in the game
    const isWhitePlayer = connection.user.id === game.whiteId;
    const isBlackPlayer = connection.user.id === game.blackId;

    if (!isWhitePlayer && !isBlackPlayer) {
      this.sendError(connection, 'NOT_IN_GAME', 'Not a player in this game');
      return;
    }

    const playerColor = isWhitePlayer ? 'white' : 'black';
    const timestamp = Date.now();

    console.log(`[CHAT] ${connection.user.handle} sent message in game ${gameId}: ${chatMessage}`);

    // Update user activity
    this.updateUserActivity(connection.user.id);

    // Store message in game state
    if (!game.chatMessages) {
      game.chatMessages = [];
    }
    game.chatMessages.push({
      from: playerColor,
      message: chatMessage,
      timestamp
    });

    // Broadcast message to both players
    this.broadcastToGame(gameId, {
      t: 'chat.received',
      gameId,
      from: playerColor,
      message: chatMessage,
      timestamp
    });
  }

  private async handleTournamentChatMessage(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const tournamentId = message.tournamentId;
    const chatMessage = message.message;

    if (!tournamentId || !chatMessage) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing tournamentId or message');
      return;
    }

    if (!this.prisma) {
      this.sendError(connection, 'SERVICE_UNAVAILABLE', 'Database service unavailable');
      return;
    }

    try {
      // Check if tournament exists
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, status: true }
      });

      if (!tournament) {
        this.sendError(connection, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
        return;
      }

      // Verify user is a participant in the tournament
      const tournamentPlayer = await this.prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: tournamentId,
            userId: connection.user.id
          }
        }
      });

      if (!tournamentPlayer) {
        this.sendError(connection, 'NOT_IN_TOURNAMENT', 'You must join the tournament to chat');
        return;
      }

      const timestamp = Date.now();

      console.log(`[TOURNAMENT CHAT] ${connection.user.handle} sent message in tournament ${tournamentId}: ${chatMessage}`);

      // Update user activity
      this.updateUserActivity(connection.user.id);

      // Persist message to database
      await this.prisma.tournamentMessage.create({
        data: {
          tournamentId: tournamentId,
          userId: connection.user.id,
          content: chatMessage
        }
      });

      // Get all tournament player userIds
      const tournamentPlayers = await this.prisma.tournamentPlayer.findMany({
        where: { tournamentId: tournamentId },
        select: { userId: true }
      });

      const playerUserIds = tournamentPlayers.map((p: { userId: string }) => p.userId);

      // Broadcast message to all tournament participants
      this.broadcastToTournamentPlayers(playerUserIds, {
        type: 'tournament.chat.received',
        tournamentId,
        userId: connection.user.id,
        handle: connection.user.handle,
        message: chatMessage,
        timestamp
      });
    } catch (error) {
      console.error('[ERR] Failed to handle tournament chat message:', error);
      this.sendError(connection, 'INTERNAL_ERROR', 'Failed to send message');
    }
  }

  private async handleTeamTournamentSubscribe(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const tournamentId = message.tournamentId;
    if (!tournamentId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing tournamentId');
      return;
    }

    // Add tournament to subscription set
    connection.subscribedTeamTournaments.add(tournamentId);

    console.log(`[TEAM_TOURNAMENT] ${connection.user.handle} subscribed to team tournament ${tournamentId}`);

    // Send confirmation
    this.sendMessage(connection, {
      t: 'team-tournament.subscribed',
      tournamentId
    });
  }

  private async handleTeamTournamentUnsubscribe(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const tournamentId = message.tournamentId;
    if (!tournamentId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Missing tournamentId');
      return;
    }

    // Remove tournament from subscription set
    connection.subscribedTeamTournaments.delete(tournamentId);

    console.log(`[TEAM_TOURNAMENT] ${connection.user.handle} unsubscribed from team tournament ${tournamentId}`);

    // Send confirmation
    this.sendMessage(connection, {
      t: 'team-tournament.unsubscribed',
      tournamentId
    });
  }

  // Helper method to end a game and clear timeouts
  private endGame = async (gameId: string, result: string, reason: string) => {
    const game = this.gameManager.getGame(gameId);
    if (!game || game.ended) return;

    console.log(`[GAMEEND] Ending game ${gameId} with result: ${result}, reason: ${reason}`);

    // Update game state
    game.ended = true;
    game.result = result;
    game.endedAt = Date.now();

    // Clear timeout
    if (game.timeoutId) {
      clearTimeout(game.timeoutId);
      game.timeoutId = null;
    }

    // Persist game to database first (this updates ratings)
    await this.persistGameToDatabase(game);

    // Record tournament game result if applicable
    await this.tournamentManager.recordGameResult(
      gameId,
      game.whiteId,
      game.blackId,
      result
    );

    // Fetch rating changes after persistence
    const ratingChanges = await this.getRatingChanges(gameId);

    // Broadcast game end to both players with rating changes
    this.broadcastToGame(gameId, {
      t: 'game.end',
      gameId,
      result,
      reason,
      ratingChanges  // Include rating data
    });

    // Note: Game end push notifications removed
    // Players can check their game history when they want to see results

    // Clear game references from connections
    for (const [ws, connection] of this.connections.entries()) {
      if (connection.currentGameId === gameId) {
        connection.currentGameId = null;
      }
    }
  }

  // Helper method to get rating changes for a game
  private async getRatingChanges(gameId: string) {
    try {
      if (!this.prisma) return null;

      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: {
          whiteId: true,
          blackId: true,
          whiteRatingBefore: true,
          blackRatingBefore: true,
          whiteRatingAfter: true,
          blackRatingAfter: true,
        }
      });

      if (!game) return null;

      return {
        white: {
          userId: game.whiteId,
          before: game.whiteRatingBefore || 1500,
          after: game.whiteRatingAfter || 1500,
          change: (game.whiteRatingAfter || 1500) - (game.whiteRatingBefore || 1500)
        },
        black: {
          userId: game.blackId,
          before: game.blackRatingBefore || 1500,
          after: game.blackRatingAfter || 1500,
          change: (game.blackRatingAfter || 1500) - (game.blackRatingBefore || 1500)
        }
      };
    } catch (error) {
      console.error('[ERR] Failed to get rating changes:', error);
      return null;
    }
  }

  // Helper method to broadcast to all players and spectators in a game
  private broadcastToGame(gameId: string, message: any, excludeUserId?: string) {
    const game = this.gameManager.getGame(gameId);
    if (!game) return;

    let sentCount = 0;
    for (const [ws, connection] of this.connections.entries()) {
      // Check if connection is for a player in this game (either by currentGameId OR by being whiteId/blackId)
      const isPlayer = connection.currentGameId === gameId ||
                       (connection.user && (connection.user.id === game.whiteId || connection.user.id === game.blackId));
      
      // Check if connection is spectating this game
      const isSpectating = connection.spectatingGames.has(gameId);
      
      const isInGame = isPlayer || isSpectating;

      if (isInGame &&
          connection.user &&
          connection.user.id !== excludeUserId &&
          ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sentCount++;
        const role = isPlayer ? 'player' : 'spectator';
        console.log(`[SEND] Sent ${message.t} to ${role} ${connection.user.handle} (${connection.user.id})`);
      }
    }
    console.log(`[SEND] Broadcast ${message.t} to ${sentCount} connections in game ${gameId}`);
  }

  // Helper method to broadcast to tournament players
  private broadcastToTournamentPlayers = (userIds: string[], message: any) => {
    let sentCount = 0;
    for (const [ws, connection] of this.connections.entries()) {
      if (connection.user &&
          userIds.includes(connection.user.id) &&
          ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sentCount++;
        console.log(`[TOURNAMENT] Sent ${message.type} to ${connection.user.handle} (${connection.user.id})`);
      }
    }
    console.log(`[TOURNAMENT] Broadcast ${message.type} to ${sentCount}/${userIds.length} tournament players`);
  }

  // Helper method to broadcast to team tournament subscribers
  private broadcastToTeamTournament(tournamentId: string, message: any) {
    let sentCount = 0;
    for (const [ws, connection] of this.connections.entries()) {
      if (connection.subscribedTeamTournaments.has(tournamentId) &&
          ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        sentCount++;
        console.log(`[TEAM_TOURNAMENT] Sent ${message.t} to ${connection.user?.handle || 'unknown'} (${connection.user?.id || 'unknown'})`);
      }
    }
    console.log(`[TEAM_TOURNAMENT] Broadcast ${message.t} to ${sentCount} subscribers of tournament ${tournamentId}`);
  }

  // Set up Redis pub/sub subscriptions for team tournament events
  private setupTeamTournamentSubscriptions() {
    // Subscribe to team tournament update events
    this.redisSubscriber.subscribe('tournament:team:update', (data: any) => {
      console.log('[REDIS] Received tournament:team:update event:', data);
      this.broadcastToTeamTournament(data.tournamentId, {
        t: 'team-tournament.update',
        tournamentId: data.tournamentId,
        gameId: data.gameId,
        whiteTeamId: data.whiteTeamId,
        blackTeamId: data.blackTeamId,
        result: data.result,
        timestamp: data.timestamp,
      });
    });

    // Subscribe to team tournament start events
    this.redisSubscriber.subscribe('tournament:team:start', (data: any) => {
      console.log('[REDIS] Received tournament:team:start event:', data);
      this.broadcastToTeamTournament(data.tournamentId, {
        t: 'team-tournament.start',
        tournamentId: data.tournamentId,
        timestamp: data.timestamp,
      });
    });

    // Subscribe to team tournament end events
    this.redisSubscriber.subscribe('tournament:team:end', (data: any) => {
      console.log('[REDIS] Received tournament:team:end event:', data);
      this.broadcastToTeamTournament(data.tournamentId, {
        t: 'team-tournament.end',
        tournamentId: data.tournamentId,
        winnerTeamId: data.winnerTeamId,
        timestamp: data.timestamp,
      });
    });

    // Subscribe to team withdrawal events
    this.redisSubscriber.subscribe('tournament:team:withdraw', (data: any) => {
      console.log('[REDIS] Received tournament:team:withdraw event:', data);
      this.broadcastToTeamTournament(data.tournamentId, {
        t: 'team-tournament.withdraw',
        tournamentId: data.tournamentId,
        teamId: data.teamId,
        timestamp: data.timestamp,
      });
    });

    console.log('[REDIS] Team tournament subscriptions set up');
  }

  private async handleGameSpectate(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Game ID is required');
      return;
    }

    const game = this.gameManager.getGame(gameId);
    if (!game) {
      this.sendError(connection, 'GAME_NOT_FOUND', 'Game not found');
      return;
    }

    // Check if user is a player in the game
    if (connection.user.id === game.whiteId || connection.user.id === game.blackId) {
      this.sendError(connection, 'INVALID_REQUEST', 'You are a player in this game');
      return;
    }

    // Check if game has ended
    if (game.ended) {
      this.sendError(connection, 'GAME_ENDED', 'Game has already ended');
      return;
    }

    // Add to spectating games
    connection.spectatingGames.add(gameId);
    console.log(`[SPECTATE] User ${connection.user.handle} (${connection.user.id}) started spectating game ${gameId}`);

    // Send current game state to spectator
    const gameState: any = {
      t: 'game.state',
      gameId: game.id,
      whiteId: game.whiteId,
      blackId: game.blackId,
      moves: game.moves || [],
      timeLeft: game.timeLeft,
      toMove: game.toMove,
      tc: game.tc,
      chess960Position: game.chess960Position,
      initialFen: game.initialFen,
      result: game.result,
      ended: game.ended,
    };

    this.sendMessage(connection, gameState);

    // Send confirmation
    this.sendMessage(connection, {
      t: 'game.spectating',
      gameId,
      success: true,
    });
  }

  private async handleGameUnspectate(connection: ClientConnection, message: any) {
    if (!connection.user) {
      this.sendError(connection, 'UNAUTHORIZED', 'User not authenticated');
      return;
    }

    const gameId = message.gameId;
    if (!gameId) {
      this.sendError(connection, 'INVALID_MESSAGE', 'Game ID is required');
      return;
    }

    // Remove from spectating games
    connection.spectatingGames.delete(gameId);
    console.log(`[SPECTATE] User ${connection.user.handle} (${connection.user.id}) stopped spectating game ${gameId}`);

    // Send confirmation
    this.sendMessage(connection, {
      t: 'game.unspectating',
      gameId,
      success: true,
    });
  }

  private async validateSession(sessionId: string): Promise<User | null> {
    try {
      console.log('[DEBUG] Validating session with token:', sessionId.substring(0, 20) + '...');
      console.log('[DEBUG] Full sessionId length:', sessionId.length);

      // Check for empty or invalid session
      if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
        console.log('[WARN] Empty or invalid sessionId, creating guest user');
        const guestUser: User = {
          id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          handle: `Guest${Math.random().toString(36).substr(2, 6)}`,
        };
        return guestUser;
      }

      // Import auth service to validate JWT tokens
      const { getAuthService } = await import('@chess960/utils');
      const authService = getAuthService();

      // Try to validate as JWT token first
      const payload = authService.verifyAuthToken(sessionId);
      console.log('[DEBUG] JWT verification result:', payload ? 'SUCCESS' : 'FAILED');

      if (payload) {
        // Valid JWT token - return user from token payload
        console.log('[OK] Valid JWT token for user:', payload.userId);
        console.log('[OK] User handle:', payload.handle);
        console.log('[OK] User type:', payload.type);
        return {
          id: payload.userId,
          handle: payload.handle,
          email: payload.email || undefined,
        };
      }

      // JWT validation failed - create guest user as fallback
      console.log('[WARN] JWT validation failed, creating guest user as fallback');
      const guestUser: User = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        handle: `Guest${Math.random().toString(36).substr(2, 6)}`,
      };
      return guestUser;
    } catch (error) {
      console.error('Error validating session:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Even on error, create guest user as fallback
      console.log('[WARN] Exception during validation, creating guest user as fallback');
      const guestUser: User = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        handle: `Guest${Math.random().toString(36).substr(2, 6)}`,
      };
      return guestUser;
    }
  }

  private async persistGameStart(game: any) {
    try {
      // Convert to format expected by persistence service
      const gameState = {
        id: game.id,
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteConnection: null,
        blackConnection: null,
        tc: game.tc,
        chess960Position: game.chess960Position,
        initialFen: game.initialFen,
        moves: game.moves || [],
        timeLeft: {
          white: game.timeLeft?.w || 0,
          black: game.timeLeft?.b || 0,
        },
        increment: {
          white: 0,
          black: 0,
        },
        toMove: game.toMove || 'white',
        drawOffer: null,
        takebackOffer: null,
        result: null,
        ended: false,
        startedAt: game.startedAt?.getTime() || Date.now(),
        lastMoveAt: Date.now(),
        clockStartedFor: {
          white: false,
          black: false,
        },
      };

      await this.persistenceService.persistGameStart(gameState);
      console.log(`[OK] Game ${game.id} persisted as live game`);
    } catch (error) {
      console.error(`[ERR] Failed to persist game start ${game.id}:`, error);
    }
  }

  private async persistGameToDatabase(game: any) {
    try {
      console.log(`[DB] Persisting game ${game.id} to database...`);

      // Convert to format expected by persistence service
      const gameState = {
        id: game.id,
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteConnection: null,
        blackConnection: null,
        tc: game.tc, // IMPORTANT: Include time control!
        chess960Position: game.chess960Position, // Chess960 position (1-960)
        initialFen: game.initialFen, // Chess960 initial FEN
        moves: game.moves || [],
        timeLeft: {
          white: game.timeLeft?.w || 0,
          black: game.timeLeft?.b || 0,
        },
        increment: {
          white: 0, // Both 1+0 and 2+0 have no increment
          black: 0,
        },
        toMove: game.toMove || 'white',
        drawOffer: null,
        takebackOffer: null,
        result: game.result,
        ended: true,
        startedAt: game.startedAt?.getTime() || Date.now(),
        lastMoveAt: game.lastMoveTime || Date.now(),
        clockStartedFor: {
          white: true,
          black: true,
        },
      };

      await this.persistenceService.persistGame(gameState);
      console.log(`[OK] Game ${game.id} persisted successfully`);
    } catch (error) {
      console.error(`[ERR] Failed to persist game ${game.id}:`, error);
    }
  }

  // Removed game move push notifications to avoid spam
  // Players can check the game when they're ready

  // Removed game end push notifications
  // Players can check their game history when they want to see results

  public stop() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
    }
    if (this.firstMoveTimeoutInterval) {
      clearInterval(this.firstMoveTimeoutInterval);
    }
    this.tournamentManager.stop();
    this.redisPubSub.close();
    this.wss.close();
    this.server.close();
    this.healthServer.close();
  }
}
