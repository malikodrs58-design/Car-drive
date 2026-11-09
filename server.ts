import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now() });
});

// WebSocket Server for Real-Time Multiplayer
const wss = new WebSocketServer({ server, path: '/ws' });

interface RemotePlayer {
  id: string;
  name: string;
  carModel: string;
  color: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steering: number;
  isBoosting: boolean;
  isDrifting: boolean;
  lap: number;
  currentCheckpoint: number;
  lapTimes: number[];
  bestLapTime: number | null;
  isFinished: boolean;
  finishRank: number | null;
  inVR: boolean;
  lastUpdate: number;
  ws?: WebSocket;
}

interface AIRacer {
  id: string;
  name: string;
  carModel: string;
  color: string;
  waypointIndex: number;
  segmentT: number;
  speed: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  lap: number;
  currentCheckpoint: number;
  isBoosting: boolean;
  isDrifting: boolean;
}

const TRACK_WAYPOINTS = [
  { x: 0, z: 0 },
  { x: 0, z: 120 },
  { x: 30, z: 180 },
  { x: 90, z: 210 },
  { x: 160, z: 180 },
  { x: 190, z: 110 },
  { x: 160, z: 30 },
  { x: 110, z: -40 },
  { x: 140, z: -110 },
  { x: 90, z: -180 },
  { x: 10, z: -210 },
  { x: -60, z: -170 },
  { x: -90, z: -90 },
  { x: -70, z: -10 },
  { x: -40, z: 40 },
  { x: -15, z: -30 },
];

interface Room {
  id: string;
  name: string;
  hostId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  countdownTimer: number;
  players: Map<string, RemotePlayer>;
  aiRacers: AIRacer[];
  chatMessages: { id: string; sender: string; text: string; time: string }[];
  finishOrder: string[];
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string, roomName = 'حلبة السباق الرئيسية'): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      name: roomName,
      hostId: '',
      status: 'waiting',
      countdownTimer: 0,
      players: new Map(),
      aiRacers: [
        {
          id: 'ai_fahd',
          name: 'فهد السرعة (AI)',
          carModel: 'formula',
          color: '#ff0055',
          waypointIndex: 0,
          segmentT: 0.15,
          speed: 36,
          x: 2.5,
          y: 0,
          z: 20,
          yaw: 0,
          lap: 1,
          currentCheckpoint: 0,
          isBoosting: false,
          isDrifting: false,
        },
        {
          id: 'ai_saqr',
          name: 'صقر النيون (AI)',
          carModel: 'buggy',
          color: '#ffaa00',
          waypointIndex: 0,
          segmentT: 0.05,
          speed: 33,
          x: -2.5,
          y: 0,
          z: 8,
          yaw: 0,
          lap: 1,
          currentCheckpoint: 0,
          isBoosting: false,
          isDrifting: false,
        },
        {
          id: 'ai_saroukh',
          name: 'الصاروخ (AI)',
          carModel: 'muscle',
          color: '#00ff66',
          waypointIndex: 15,
          segmentT: 0.7,
          speed: 31,
          x: 3.0,
          y: 0,
          z: -12,
          yaw: 0,
          lap: 1,
          currentCheckpoint: 7,
          isBoosting: false,
          isDrifting: false,
        },
      ],
      chatMessages: [
        {
          id: 'welcome',
          sender: 'نظام السباق',
          text: 'أهلاً بكم في مضمار الواقع الافتراضي! استعدوا للانطلاق.',
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      finishOrder: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

// Quick room list API
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    playerCount: r.players.size,
    status: r.status,
  }));
  res.json(roomList);
});

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let playerId: string | null = null;

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      if (data.type === 'join_room') {
        const targetRoomId: string = data.roomId || 'main-arena';
        const targetPlayerId: string = data.playerId || `driver_${Math.random().toString(36).substring(2, 7)}`;
        currentRoomId = targetRoomId;
        playerId = targetPlayerId;

        const room = getOrCreateRoom(targetRoomId, data.roomName);
        if (!room.hostId) {
          room.hostId = targetPlayerId;
        }

        const player: RemotePlayer = {
          id: targetPlayerId,
          name: data.playerName || 'سائق المستقبل',
          carModel: data.carModel || 'hypercar',
          color: data.color || '#ff0055',
          x: (room.players.size % 2 === 0 ? -3 : 3),
          y: 0,
          z: -(room.players.size * 8),
          yaw: 0,
          speed: 0,
          steering: 0,
          isBoosting: false,
          isDrifting: false,
          lap: 1,
          currentCheckpoint: 0,
          lapTimes: [],
          bestLapTime: null,
          isFinished: false,
          finishRank: null,
          inVR: !!data.inVR,
          lastUpdate: Date.now(),
          ws,
        };

        room.players.set(targetPlayerId, player);

        // Send confirmation and current room state
        const serializedPlayers = Array.from(room.players.values()).map((p) => {
          const { ws: _, ...rest } = p;
          return rest;
        });

        ws.send(
          JSON.stringify({
            type: 'room_joined',
            roomId: room.id,
            playerId,
            isHost: room.hostId === playerId,
            status: room.status,
            countdownTimer: room.countdownTimer,
            players: serializedPlayers,
            chatMessages: room.chatMessages.slice(-15),
          })
        );

        // Broadcast to other players in room
        const joinNotification = JSON.stringify({
          type: 'player_joined',
          player: { ...player, ws: undefined },
        });
        room.players.forEach((p) => {
          if (p.id !== playerId && p.ws?.readyState === WebSocket.OPEN) {
            p.ws.send(joinNotification);
          }
        });
      }

      if (data.type === 'update_state' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const player = room.players.get(playerId);
          if (player) {
            player.x = data.x ?? player.x;
            player.y = data.y ?? player.y;
            player.z = data.z ?? player.z;
            player.yaw = data.yaw ?? player.yaw;
            player.speed = data.speed ?? player.speed;
            player.steering = data.steering ?? player.steering;
            player.isBoosting = !!data.isBoosting;
            player.isDrifting = !!data.isDrifting;
            player.lap = data.lap ?? player.lap;
            player.currentCheckpoint = data.currentCheckpoint ?? player.currentCheckpoint;
            player.bestLapTime = data.bestLapTime ?? player.bestLapTime;
            player.inVR = !!data.inVR;
            player.lastUpdate = Date.now();
          }
        }
      }

      if (data.type === 'start_race' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room && (room.hostId === playerId || room.status === 'waiting')) {
          room.status = 'countdown';
          room.countdownTimer = 3;
          room.finishOrder = [];

          // Broadcast countdown
          const broadcastMsg = (msg: object) => {
            const raw = JSON.stringify(msg);
            room.players.forEach((p) => {
              if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(raw);
            });
          };

          broadcastMsg({ type: 'race_countdown', count: 3 });

          const interval = setInterval(() => {
            room.countdownTimer -= 1;
            if (room.countdownTimer > 0) {
              broadcastMsg({ type: 'race_countdown', count: room.countdownTimer });
            } else if (room.countdownTimer === 0) {
              room.status = 'racing';
              broadcastMsg({ type: 'race_start' });
              clearInterval(interval);
            }
          }, 1000);
        }
      }

      if (data.type === 'race_finished' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const player = room.players.get(playerId);
          if (player && !player.isFinished) {
            player.isFinished = true;
            room.finishOrder.push(playerId);
            player.finishRank = room.finishOrder.length;

            const finishMsg = JSON.stringify({
              type: 'player_finished',
              playerId,
              rank: player.finishRank,
              totalTime: data.totalTime,
              bestLap: data.bestLap,
            });

            room.players.forEach((p) => {
              if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(finishMsg);
            });
          }
        }
      }

      if (data.type === 'chat_message' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const player = room.players.get(playerId);
          const msg = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            sender: player?.name || 'سائق',
            text: (data.text || '').substring(0, 100),
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          };
          room.chatMessages.push(msg);
          if (room.chatMessages.length > 30) room.chatMessages.shift();

          const broadcastMsg = JSON.stringify({ type: 'new_chat', message: msg });
          room.players.forEach((p) => {
            if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(broadcastMsg);
          });
        }
      }

      if (data.type === 'quick_emote' && currentRoomId && playerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const player = room.players.get(playerId);
          const emoteMsg = JSON.stringify({
            type: 'player_emote',
            playerId,
            sender: player?.name,
            emote: data.emote,
          });
          room.players.forEach((p) => {
            if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(emoteMsg);
          });
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && playerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(playerId);
        if (room.hostId === playerId) {
          const nextHost = room.players.keys().next().value;
          room.hostId = nextHost || '';
        }

        const leaveMsg = JSON.stringify({
          type: 'player_left',
          playerId,
          newHostId: room.hostId,
        });

        room.players.forEach((p) => {
          if (p.ws?.readyState === WebSocket.OPEN) p.ws.send(leaveMsg);
        });

        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

// Broadcast 20Hz state tick to sync cars smoothly across network
setInterval(() => {
  rooms.forEach((room) => {
    if (room.players.size === 0) return;

    // Step AI racers along track waypoints
    room.aiRacers.forEach((ai) => {
      const p1 = TRACK_WAYPOINTS[ai.waypointIndex];
      const nextIdx = (ai.waypointIndex + 1) % TRACK_WAYPOINTS.length;
      const p2 = TRACK_WAYPOINTS[nextIdx];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLen = Math.sqrt(dx * dx + dz * dz) || 1;

      // Advance along segment
      const stepDist = ai.speed * 0.05;
      ai.segmentT += stepDist / segLen;

      if (ai.segmentT >= 1.0) {
        ai.segmentT -= 1.0;
        ai.waypointIndex = nextIdx;
        ai.currentCheckpoint = Math.floor((ai.waypointIndex / TRACK_WAYPOINTS.length) * 8);
        if (nextIdx === 0) {
          ai.lap += 1;
        }
      }

      const curP1 = TRACK_WAYPOINTS[ai.waypointIndex];
      const curP2 = TRACK_WAYPOINTS[(ai.waypointIndex + 1) % TRACK_WAYPOINTS.length];
      const curDx = curP2.x - curP1.x;
      const curDz = curP2.z - curP1.z;

      ai.x = curP1.x + curDx * ai.segmentT;
      ai.z = curP1.z + curDz * ai.segmentT;
      ai.yaw = Math.atan2(curDx, curDz);
    });

    const humanUpdates = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      carModel: p.carModel,
      color: p.color,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      speed: p.speed,
      steering: p.steering,
      isBoosting: p.isBoosting,
      isDrifting: p.isDrifting,
      lap: p.lap,
      currentCheckpoint: p.currentCheckpoint,
      bestLapTime: p.bestLapTime,
      inVR: p.inVR,
    }));

    // Fill remaining spots up to 4 racers with AI bots
    const neededBots = Math.max(0, 4 - humanUpdates.length);
    const botUpdates = room.aiRacers.slice(0, neededBots).map((b) => ({
      id: b.id,
      name: b.name,
      carModel: b.carModel,
      color: b.color,
      x: b.x,
      y: 0,
      z: b.z,
      yaw: b.yaw,
      speed: b.speed,
      steering: 0,
      isBoosting: b.isBoosting,
      isDrifting: b.isDrifting,
      lap: b.lap,
      currentCheckpoint: b.currentCheckpoint,
      bestLapTime: 38.5,
      inVR: false,
    }));

    const updates = [...humanUpdates, ...botUpdates];

    const packet = JSON.stringify({
      type: 'sync_tick',
      players: updates,
    });

    room.players.forEach((p) => {
      if (p.ws?.readyState === WebSocket.OPEN) {
        p.ws.send(packet);
      }
    });
  });
}, 50); // 20 times per second

// Mount Vite middleware in dev or serve dist in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`VR Cyber Racers server running on http://localhost:${PORT}`);
  });
}

startServer();
