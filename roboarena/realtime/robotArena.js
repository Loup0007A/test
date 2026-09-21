// RoboArena — Realtime "Human Robot" layer.
//
// Generic relay: an admin can "go live" for a given gameId. The next player
// who opens that game's page gets matched 1:1 with that admin's socket
// instead of the local AI. From then on the two sockets just relay small
// JSON actions to each other through a shared room — each game's own
// client script decides what those actions mean (see ROBOT_MODE.md).
//
// Auth: sockets share the same express-session cookie as the HTTP app, so
// we know which socket belongs to an actual logged-in admin without a
// separate login step.

const { Server } = require('socket.io');
const { Users } = require('../models/db');

function initRealtime(httpServer, sessionMiddleware) {
  const io = new Server(httpServer);

  // Reuse the Express session so `socket.request.session` is populated.
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Resolve which user (if any) owns this socket.
  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;
      const userId = session ? session.userId : null;
      socket.data.userId = userId || null;
      socket.data.user = userId ? await Users.findById(userId) : null;
      next();
    } catch (err) {
      next(err);
    }
  });

  // gameId -> { adminSocketId, waitingPlayer, roomId }
  const liveRobots = new Map();

  function isAdmin(socket) {
    return !!(socket.data.user && socket.data.user.role === 'admin' && !socket.data.user.banned);
  }

  function stopAdminSessions(adminSocketId) {
    for (const [gameId, entry] of liveRobots.entries()) {
      if (entry.adminSocketId === adminSocketId) {
        liveRobots.delete(gameId);
        io.emit('robot:availability-changed', { gameId, live: false });
      }
    }
  }

  io.on('connection', (socket) => {
    // ── Admin: start being the robot for a given game ──
    socket.on('robot:go-live', (payload) => {
      if (!isAdmin(socket)) return socket.emit('robot:error', 'Non autorisé.');
      const gameId = payload && payload.gameId;
      if (!gameId) return;
      stopAdminSessions(socket.id); // one live game at a time per admin socket
      liveRobots.set(gameId, {
        adminSocketId: socket.id,
        adminUsername: socket.data.user.username,
        waitingPlayer: null,
        roomId: null,
      });
      socket.data.liveGameId = gameId;
      socket.emit('robot:live-started', { gameId });
      io.emit('robot:availability-changed', { gameId, live: true });
    });

    socket.on('robot:go-offline', () => stopAdminSessions(socket.id));

    // ── Player: is anyone live for this game right now? ──
    socket.on('robot:check-live', (payload, cb) => {
      const gameId = payload && payload.gameId;
      const entry = liveRobots.get(gameId);
      const available = !!(entry && !entry.waitingPlayer);
      if (typeof cb === 'function') cb({ available });
    });

    // ── Player: claim the live admin for this game ──
    socket.on('robot:request-match', (payload, cb) => {
      const gameId = payload && payload.gameId;
      const entry = liveRobots.get(gameId);
      if (!entry || entry.waitingPlayer) {
        if (typeof cb === 'function') cb({ matched: false });
        return;
      }
      const roomId = `robot-session-${gameId}-${Date.now()}`;
      entry.waitingPlayer = socket.id;
      entry.roomId = roomId;

      const adminSocket = io.sockets.sockets.get(entry.adminSocketId);
      socket.join(roomId);
      socket.data.robotRoom = roomId;
      socket.data.robotGameId = gameId;

      if (adminSocket) {
        adminSocket.join(roomId);
        adminSocket.data.robotRoom = roomId;
        adminSocket.data.robotGameId = gameId;
        adminSocket.emit('robot:matched', { gameId, role: 'admin', roomId });
      }
      socket.emit('robot:matched', { gameId, role: 'player', roomId });
      if (typeof cb === 'function') cb({ matched: true, roomId });
    });

    // ── Generic relay: whatever one side sends, the other side receives ──
    socket.on('robot:action', (payload) => {
      const room = socket.data.robotRoom;
      if (!room) return;
      socket.to(room).emit('robot:action', payload);
    });

    socket.on('disconnect', () => {
      const room = socket.data.robotRoom;
      const gameId = socket.data.robotGameId;
      if (room) io.to(room).emit('robot:opponent-left');
      if (gameId) {
        const entry = liveRobots.get(gameId);
        if (entry && entry.waitingPlayer === socket.id) entry.waitingPlayer = null;
      }
      stopAdminSessions(socket.id);
    });
  });

  return io;
}

module.exports = { initRealtime };
