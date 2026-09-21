-- ═══════════════════════════════════════════════════════════
-- RoboArena — Schéma Postgres / Supabase
-- À exécuter une fois dans l'éditeur SQL Supabase (ou via psql)
-- avant de démarrer le serveur. server.js le recrée aussi tout
-- seul (CREATE TABLE IF NOT EXISTS) au boot, ce fichier sert
-- surtout de référence versionnée / pour psql en CI.
-- ═══════════════════════════════════════════════════════════

-- Nécessaire pour gen_random_uuid() sur Postgres < 16.
-- Supabase l'active déjà par défaut ; le IF NOT EXISTS rend ça sûr.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  reason      TEXT,
  admin_id    UUID,
  date        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_gameid    ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_userid    ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores(result, score DESC);
CREATE INDEX IF NOT EXISTS idx_logs_type        ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp   ON logs(timestamp DESC);

-- Remarque RLS : le serveur Express se connecte avec un rôle
-- Postgres privilégié via une connexion directe (session pooler),
-- pas via l'API PostgREST/Data API de Supabase. Row Level Security
-- n'est donc pas nécessaire ici. Si un jour vous exposez ces tables
-- via l'API Supabase (supabase-js côté client, etc.), activez RLS
-- et écrivez des policies avant de le faire.
