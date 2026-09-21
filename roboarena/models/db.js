// RoboArena — Data layer, now backed by Postgres (Supabase) instead of LowDB.
// Every method that used to be synchronous is now async and must be awaited
// by callers. See MIGRATION_SUPABASE.md for connection setup.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Not throwing here so `npm run dev` still boots far enough to show a
  // useful error message instead of a confusing stack trace.
  console.warn('[DB] ⚠️  DATABASE_URL manquant. Voir .env.example / MIGRATION_SUPABASE.md');
}

const pool = new Pool({
  connectionString,
  // Supabase's pooler terminates TLS with a cert that Node's default CA
  // bundle doesn't always trust; rejectUnauthorized:false is the standard
  // approach recommended by Supabase for server-side pg clients.
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
});

pool.on('error', (err) => {
  // Fired on idle client errors (e.g. connection dropped by the pooler).
  // Without this handler an uncaught error here crashes the whole process.
  console.error('[DB] Erreur inattendue sur le pool Postgres:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function ensureSchema() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch((e) => {
    // Supabase's default role usually has permission; if not, schema.sql
    // must be run manually once with an admin role. Don't crash the boot.
    console.warn('[DB] Impossible de créer l\'extension pgcrypto automatiquement:', e.message);
  });

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password      TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'player',
      avatar        TEXT DEFAULT '👤',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login    TIMESTAMPTZ,
      wins          INTEGER NOT NULL DEFAULT 0,
      losses        INTEGER NOT NULL DEFAULT 0,
      games_played  INTEGER NOT NULL DEFAULT 0,
      banned        BOOLEAN NOT NULL DEFAULT false,
      ban_reason    TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      username    TEXT NOT NULL,
      game_id     TEXT NOT NULL,
      game_name   TEXT NOT NULL,
      score       INTEGER NOT NULL DEFAULT 0,
      result      TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
      duration    INTEGER NOT NULL DEFAULT 0,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type        TEXT NOT NULL,
      data        JSONB NOT NULL DEFAULT '{}'::jsonb,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bans (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL,
      reason      TEXT,
      admin_id    UUID,
      date        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_scores_gameid ON scores(game_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_scores_userid ON scores(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores(result, score DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type)');
  await query('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)');
}

// ── Row → app-shape mappers (snake_case columns → the camelCase shape
//    every view/route already expects, so templates didn't need to change) ──
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    role: row.role,
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    banned: row.banned,
    banReason: row.ban_reason,
  };
}

function mapScore(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    gameId: row.game_id,
    gameName: row.game_name,
    score: row.score,
    result: row.result,
    duration: row.duration,
    timestamp: row.timestamp,
  };
}

function mapLog(row) {
  if (!row) return null;
  return { id: row.id, type: row.type, data: row.data, timestamp: row.timestamp };
}

// ── Logging ──
async function log(type, data) {
  try {
    await query('INSERT INTO logs (type, data) VALUES ($1, $2)', [type, JSON.stringify(data || {})]);
  } catch (err) {
    // A logging failure must never break the request it's logging.
    console.error('[DB] log() a échoué:', err.message);
  }
}

const Logs = {
  async getAll() {
    const { rows } = await query('SELECT * FROM logs ORDER BY timestamp DESC');
    return rows.map(mapLog);
  },
  async getRecent(limit = 100) {
    const { rows } = await query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    return rows.map(mapLog);
  },
  async getByType(type, limit = 500) {
    const { rows } = await query(
      'SELECT * FROM logs WHERE type = $1 ORDER BY timestamp DESC LIMIT $2',
      [type, limit]
    );
    return rows.map(mapLog);
  },
  async getTypes() {
    const { rows } = await query('SELECT DISTINCT type FROM logs ORDER BY type');
    return rows.map((r) => r.type);
  },
  // Used for accurate "today" dashboard stats — previously the dashboard
  // only ever looked at the last 100 log rows, so "today's logins" silently
  // undercounted on any busy day. This queries the whole table instead.
  async countSince(type, sinceDate) {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS count FROM logs WHERE type = $1 AND timestamp >= $2',
      [type, sinceDate]
    );
    return rows[0].count;
  },
};

// ── Users ──
const Users = {
  async findById(id) {
    if (!id) return null;
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return mapUser(rows[0]);
  },
  async findByUsername(username) {
    if (!username) return null;
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [String(username).toLowerCase()]);
    return mapUser(rows[0]);
  },
  async findByEmail(email) {
    if (!email) return null;
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
    return mapUser(rows[0]);
  },
  async getAll() {
    const { rows } = await query('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(mapUser);
  },
  async create(data) {
    const hashed = bcrypt.hashSync(data.password, 12);
    const { rows } = await query(
      `INSERT INTO users (username, email, password, role, avatar)
       VALUES ($1, $2, $3, 'player', $4) RETURNING *`,
      [data.username.trim().toLowerCase(), data.email.trim().toLowerCase(), hashed, data.avatar || '👤']
    );
    const user = mapUser(rows[0]);
    await log('user_register', { username: user.username, email: user.email });
    return user;
  },
  async update(id, data) {
    const fieldMap = {
      lastLogin: 'last_login',
      banned: 'banned',
      banReason: 'ban_reason',
      wins: 'wins',
      losses: 'losses',
      gamesPlayed: 'games_played',
      role: 'role',
      avatar: 'avatar',
      email: 'email',
      username: 'username',
    };
    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, col] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sets.push(`${col} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (!sets.length) return Users.findById(id);
    values.push(id);
    const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    return mapUser(rows[0]);
  },
  async ban(id, reason, adminId) {
    await query('UPDATE users SET banned = true, ban_reason = $1 WHERE id = $2', [reason, id]);
    await query('INSERT INTO bans (user_id, reason, admin_id) VALUES ($1, $2, $3)', [id, reason, adminId || null]);
    await log('user_ban', { userId: id, reason, adminId });
  },
  async unban(id, adminId) {
    await query('UPDATE users SET banned = false, ban_reason = NULL WHERE id = $1', [id]);
    await log('user_unban', { userId: id, adminId });
  },
  async remove(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
  },
  async recordGame(userId, won) {
    await query(
      `UPDATE users SET games_played = games_played + 1,
                         wins = wins + $1,
                         losses = losses + $2
       WHERE id = $3`,
      [won ? 1 : 0, won ? 0 : 1, userId]
    );
  },
  // Password check stays synchronous — bcrypt.compareSync doesn't touch the DB.
  verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password);
  },
};

// ── Scores ──
const Scores = {
  async add(data) {
    await query(
      `INSERT INTO scores (user_id, username, game_id, game_name, score, result, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [data.userId, data.username, data.gameId, data.gameName, data.score, data.result, data.duration]
    );
  },
  async getLeaderboard(gameId, limit = 10) {
    const params = [];
    let where = "WHERE result = 'win'";
    if (gameId) {
      params.push(gameId);
      where += ` AND game_id = $${params.length}`;
    }
    params.push(limit);
    const { rows } = await query(
      `SELECT * FROM scores ${where} ORDER BY score DESC LIMIT $${params.length}`,
      params
    );
    return rows.map(mapScore);
  },
  async getByUser(userId) {
    const { rows } = await query('SELECT * FROM scores WHERE user_id = $1 ORDER BY timestamp ASC', [userId]);
    return rows.map(mapScore);
  },
  async getAll() {
    const { rows } = await query('SELECT * FROM scores ORDER BY timestamp DESC');
    return rows.map(mapScore);
  },
};

// ── Boot ──
async function initAdmin() {
  await ensureSchema();
  const { rows } = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!rows.length) {
    const hashed = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'RoboArena@Admin2024!', 12);
    await query(
      `INSERT INTO users (username, email, password, role, avatar)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [
        process.env.ADMIN_USERNAME || 'admin',
        process.env.CONTACT_EMAIL || 'lr000000007@gmail.com',
        hashed,
        '🤖',
      ]
    );
    console.log('[DB] Compte admin créé');
  }
}

module.exports = { pool, query, Users, Scores, Logs, log, initAdmin };
