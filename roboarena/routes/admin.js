const express = require('express');
const router = express.Router();
const { Users, Scores, Logs, log } = require('../models/db');
const { requireAdmin } = require('../middleware/auth');
const { GAMES } = require('../config/games');

// Games that already have a live "human robot" control panel wired up.
// See ROBOT_MODE.md for how to add more.
const ROBOT_READY_GAMES = ['quickdraw', 'rockpaperbot', 'tictactoe'];

router.use(requireAdmin);

// Dashboard
router.get('/', async (req, res, next) => {
  try {
    const users = await Users.getAll();
    const scores = await Scores.getAll();
    const recentLogs = await Logs.getRecent(100);

    // BUGFIX: this used to derive "today's logins/registers" from only the
    // last 100 log rows (db.get('logs').value().slice(-100)), so on any
    // busy day the counters silently undercounted. Now uses a real
    // COUNT(*) over the whole table for the current day.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [todayLogins, todayRegisters] = await Promise.all([
      Logs.countSince('login_success', startOfDay),
      Logs.countSince('user_register', startOfDay),
    ]);

    const stats = {
      totalUsers: users.filter((u) => u.role !== 'admin').length,
      activeBans: users.filter((u) => u.banned).length,
      totalGames: scores.length,
      todayLogins,
      todayRegisters,
      topGame: getTopGame(scores),
    };
    res.render('admin/dashboard', {
      title: 'Admin - RoboArena',
      users,
      stats,
      recentLogs: recentLogs.slice(0, 20),
      GAMES,
    });
  } catch (err) {
    next(err);
  }
});

function getTopGame(scores) {
  if (!scores.length) return 'N/A';
  const count = {};
  scores.forEach((s) => {
    count[s.gameName] = (count[s.gameName] || 0) + 1;
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
}

// Users management
router.get('/users', async (req, res, next) => {
  try {
    const users = (await Users.getAll()).filter((u) => u.role !== 'admin');
    res.render('admin/users', { title: 'Joueurs - Admin', users });
  } catch (err) {
    next(err);
  }
});

// User detail
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');
    const userScores = await Scores.getByUser(user.id);
    res.render('admin/user-detail', { title: `${user.username} - Admin`, targetUser: user, userScores });
  } catch (err) {
    next(err);
  }
});

// Ban user
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const { reason } = req.body;
    await Users.ban(req.params.id, reason || 'Violation des règles', req.user.id);
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

// Unban user
router.post('/users/:id/unban', async (req, res, next) => {
  try {
    await Users.unban(req.params.id, req.user.id);
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

// Delete user
router.post('/users/:id/delete', async (req, res, next) => {
  try {
    const user = await Users.findById(req.params.id);
    if (user && user.role !== 'admin') {
      await Users.remove(req.params.id);
      log('user_delete', { userId: req.params.id, adminId: req.user.id });
    }
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

// Logs
router.get('/logs', async (req, res, next) => {
  try {
    const type = req.query.type || null;
    const logs = type ? await Logs.getByType(type, 500) : (await Logs.getAll()).slice(0, 500);
    const logTypes = await Logs.getTypes();
    res.render('admin/logs', { title: 'Logs - Admin', logs, logTypes, currentType: type });
  } catch (err) {
    next(err);
  }
});

// Play as robot (admin plays instead of bot, live via Socket.IO)
router.get('/play/:gameId', (req, res) => {
  const game = GAMES.find((g) => g.id === req.params.gameId);
  if (!game) return res.redirect('/admin');
  res.render('admin/play-as-robot', {
    title: `Jouer comme Robot - ${game.name}`,
    game,
    robotSupported: ROBOT_READY_GAMES.includes(game.id),
  });
});

// Games overview
router.get('/games', async (req, res, next) => {
  try {
    const scores = await Scores.getAll();
    const gameStats = GAMES.map((g) => {
      const gameScores = scores.filter((s) => s.gameId === g.id);
      const wins = gameScores.filter((s) => s.result === 'win').length;
      return { ...g, plays: gameScores.length, robotWins: gameScores.length - wins, playerWins: wins };
    });
    res.render('admin/games', { title: 'Jeux - Admin', gameStats });
  } catch (err) {
    next(err);
  }
});

// Leaderboard
router.get('/leaderboard', async (req, res, next) => {
  try {
    const scores = await Scores.getLeaderboard(null, 50);
    res.render('admin/leaderboard', { title: 'Classement - Admin', scores });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
