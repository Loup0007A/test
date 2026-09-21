require('dotenv').config();
const express = require('express');
const http = require('http');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const { initAdmin, log } = require('./models/db');
const { injectUser, optionalAuth } = require('./middleware/auth');
const { GAMES, CATEGORIES } = require('./config/games');
const { Scores } = require('./models/db');
const { initRealtime } = require('./realtime/robotArena');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://roboarena.io').replace(/\/$/, '');

// ─── Trust proxy (Render, Railway, Heroku all use reverse proxies) ───
app.set('trust proxy', 1);

// ─── DEFAULT TEMPLATE VARIABLES ───
app.use((req, res, next) => {
  res.locals.title = 'RoboArena';
  res.locals.description = 'RoboArena - Défie les robots dans 40 mini-jeux épiques !';
  res.locals.keywords = 'jeux, robots, mini-jeux, IA, RoboArena';
  res.locals.siteUrl = SITE_URL;
  next();
});

// ─── Security ───
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        // BUGFIX: Socket.IO (used by the live "human robot" feature) opens a
        // WebSocket connection. Same-origin ws/wss is treated as 'self' by
        // modern browsers, but we spell it out explicitly for older ones.
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  })
);

// ─── Logging ───
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const accessLogStream = fs.createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ─── Middleware ───
app.use(cors({ origin: SITE_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// ─── Sessions ───
// Pulled into its own variable (rather than passed inline to app.use) so the
// exact same session parser can be reused by Socket.IO's handshake — that's
// what lets the "human robot" admin panel know who's actually an admin.
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'roboarena_dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
  },
  name: 'roboarena.sid',
});
app.use(sessionMiddleware);

// ─── Template Engine ───
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Global middleware ───
app.use(optionalAuth);
app.use(injectUser);

// ─── ROUTES ───
app.use('/', require('./routes/auth'));
app.use('/games', require('./routes/games'));
app.use('/admin', require('./routes/admin'));

// ─── HOME ───
app.get('/', async (req, res, next) => {
  try {
    const leaderboard = await Scores.getLeaderboard(null, 5);
    const featured = GAMES.slice(0, 8);
    res.render('home', {
      title: 'RoboArena - Défie les Robots dans 40 Mini-Jeux !',
      description: 'Affronte des robots dans 40 mini-jeux épiques : réflexes, stratégie, mémoire, maths et arcade !',
      keywords: 'RoboArena, jeux contre robots, mini-jeux en ligne, jeux navigateur, défis IA',
      leaderboard,
      featured,
      categories: CATEGORIES,
      totalGames: GAMES.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── LEADERBOARD ───
app.get('/leaderboard', async (req, res, next) => {
  try {
    const gameId = req.query.game || null;
    const leaderboard = await Scores.getLeaderboard(gameId, 50);
    res.render('leaderboard', {
      title: 'Classement - RoboArena',
      description: 'Classement mondial des meilleurs joueurs de RoboArena',
      leaderboard,
      games: GAMES,
      currentGame: gameId,
    });
  } catch (err) {
    next(err);
  }
});

// ─── ABOUT ───
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'À Propos - RoboArena',
    description: 'Découvrez RoboArena, la plateforme de mini-jeux contre des robots créée par Loup007A.',
  });
});

// ─── robots.txt ───
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Allow: /games
Allow: /leaderboard
Allow: /about
Allow: /login
Allow: /register

Disallow: /admin
Disallow: /admin/*
Disallow: /api/
Disallow: /data/
Disallow: /logs/

Sitemap: ${SITE_URL}/sitemap.xml`);
});

// ─── SITEMAP ───
app.get('/sitemap.xml', (req, res) => {
  const now = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/games`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${SITE_URL}/leaderboard`, changefreq: 'daily', priority: '0.8' },
    { loc: `${SITE_URL}/about`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/login`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${SITE_URL}/register`, changefreq: 'monthly', priority: '0.4' },
    ...GAMES.map((g) => ({
      loc: `${SITE_URL}/games/${g.id}`,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  const xmlUrls = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`);
});

// ─── PWA MANIFEST ───
app.get('/manifest.json', (req, res) => {
  res.json({
    name: 'RoboArena',
    short_name: 'RoboArena',
    description: 'Défie les robots dans 40 mini-jeux !',
    start_url: '/',
    display: 'standalone',
    theme_color: '#00ff88',
    background_color: '#0a0a1a',
  });
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - RoboArena',
    description: 'Page introuvable',
  });
});

// ─── ERROR ───
app.use((err, req, res, next) => {
  console.error(err);
  log('server_error', { url: req.url, error: err.message });
  res.status(500).render('500', {
    title: 'Erreur serveur - RoboArena',
    description: 'Erreur interne',
  });
});

// ─── START ───
// BUGFIX: initAdmin() used to be called fire-and-forget (fine when it was
// synchronous LowDB). Now that it awaits real network calls to Postgres, not
// awaiting it before listen() meant the server could start accepting
// requests before the `users` table (and the admin account) existed —
// causing 500s on the very first requests after a fresh deploy.
const server = http.createServer(app);
initRealtime(server, sessionMiddleware);

(async () => {
  try {
    await initAdmin();
    server.listen(PORT, () => {
      console.log(`🤖 RoboArena démarré sur http://localhost:${PORT}`);
      console.log(`🌐 Site URL: ${SITE_URL}`);
      console.log(`🎮 ${GAMES.length} jeux disponibles`);
    });
  } catch (err) {
    console.error('[BOOT] Échec du démarrage (vérifie DATABASE_URL) :', err);
    process.exit(1);
  }
})();

module.exports = app;
