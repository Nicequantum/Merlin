/**
 * Merlinus Desktop Companion WebSocket server.
 * Run alongside Next.js: `node server/companion-ws.mjs` or via `npm run dev`.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { jwtVerify } from 'jose';

const PORT = Number(process.env.COMPANION_WS_PORT || 3001);
const PUBLISH_SECRET = process.env.COMPANION_WS_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const JWT_ISSUER = 'merlin';
const JWT_AUDIENCE = 'benz-tech-session';

if (!SESSION_SECRET) {
  console.error('[companion-ws] SESSION_SECRET is required');
  process.exit(1);
}

const secretKey = new TextEncoder().encode(SESSION_SECRET);

/** @type {Map<string, { sockets: Set<import('ws').WebSocket>, seq: number }>} */
const rooms = new Map();

function getRoom(technicianId) {
  const key = `technician:${technicianId}`;
  if (!rooms.has(key)) {
    rooms.set(key, { sockets: new Set(), seq: 0 });
  }
  return rooms.get(key);
}

async function verifyWsToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const technicianId = payload.technicianId;
    if (typeof technicianId !== 'string' || !technicianId) return null;
    return { technicianId };
  } catch {
    return null;
  }
}

function broadcastToRoom(technicianId, event, excludeSocket = null) {
  const room = getRoom(technicianId);
  room.seq += 1;
  const envelope = {
    ...event,
    seq: room.seq,
    timestamp: event.timestamp || new Date().toISOString(),
  };
  const payload = JSON.stringify(envelope);
  for (const socket of room.sockets) {
    if (socket === excludeSocket) continue;
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  }
  return envelope;
}

const httpServer = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (req.method === 'POST' && req.url === '/publish') {
    if (!PUBLISH_SECRET) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Publish disabled — COMPANION_WS_SECRET not set' }));
      return;
    }

    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${PUBLISH_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body);
      const technicianId = parsed.technicianId;
      const event = parsed.event;
      if (!technicianId || !event?.type) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'technicianId and event required' }));
        return;
      }
      const envelope = broadcastToRoom(technicianId, {
        ...event,
        id: event.id || randomUUID(),
        technicianId,
        sourceDeviceId: event.sourceDeviceId || 'server',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, seq: envelope.seq }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid JSON' }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket) => {
  let authenticated = false;
  let technicianId = null;
  let authTimer = setTimeout(() => {
    if (!authenticated) socket.close(4001, 'Auth timeout');
  }, 10_000);

  socket.on('message', async (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (!authenticated) {
      if (message.type !== 'auth' || !message.token) {
        socket.send(JSON.stringify({ type: 'error', message: 'Auth required' }));
        socket.close(4001, 'Auth required');
        return;
      }
      const session = await verifyWsToken(message.token);
      if (!session) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
        socket.close(4003, 'Invalid session');
        return;
      }
      authenticated = true;
      technicianId = session.technicianId;
      clearTimeout(authTimer);
      const room = getRoom(technicianId);
      room.sockets.add(socket);
      socket.send(JSON.stringify({ type: 'auth.ok', technicianId, seq: room.seq }));
      return;
    }

    if (message.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      return;
    }

    if (message.type === 'event' && message.event && technicianId) {
      const event = message.event;
      if (event.technicianId && event.technicianId !== technicianId) {
        socket.send(JSON.stringify({ type: 'error', message: 'Technician mismatch' }));
        return;
      }
      broadcastToRoom(
        technicianId,
        {
          ...event,
          id: event.id || randomUUID(),
          technicianId,
          timestamp: event.timestamp || new Date().toISOString(),
        },
        socket
      );
    }
  });

  socket.on('close', () => {
    clearTimeout(authTimer);
    if (technicianId) {
      const room = getRoom(technicianId);
      room.sockets.delete(socket);
      if (room.sockets.size === 0) rooms.delete(`technician:${technicianId}`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[companion-ws] listening on ws://127.0.0.1:${PORT}`);
});