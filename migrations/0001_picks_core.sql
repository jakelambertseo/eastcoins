-- EastCoin Picks
-- Migration 0001: Core production schema
--
-- This migration creates the durable data model for:
-- Twitch users/sessions, seasons, markets, picks, wallet journaling,
-- admin audit history, and denormalized season statistics.
--
-- IMPORTANT:
-- This does not seed users, seasons, markets, balances, or wagers.
-- Real wagering remains disabled until later production phases.

CREATE TABLE users (
  twitch_id TEXT PRIMARY KEY,
  twitch_login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE INDEX idx_users_twitch_login
  ON users(twitch_login COLLATE NOCASE);


CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
    REFERENCES users(twitch_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user
  ON sessions(user_id);

CREATE INDEX idx_sessions_expires
  ON sessions(expires_at);


CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 0
    CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- EastCoin Picks V1 has one overall active Picks season at a time.
CREATE UNIQUE INDEX idx_seasons_one_active
  ON seasons(active)
  WHERE active = 1;


CREATE TABLE markets (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'streamed',
  provider_event_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,

  away_name TEXT NOT NULL,
  away_badge TEXT,
  home_name TEXT NOT NULL,
  home_badge TEXT,

  starts_at TEXT NOT NULL,

  state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (
      state IN (
        'OPEN',
        'LOCKED',
        'SETTLING',
        'SETTLED',
        'VOID',
        'NO_ACTION'
      )
    ),

  winner TEXT
    CHECK (winner IS NULL OR winner IN ('away', 'home')),

  locked_at TEXT,
  settled_at TEXT,

  away_pool_locked INTEGER
    CHECK (away_pool_locked IS NULL OR away_pool_locked >= 0),

  home_pool_locked INTEGER
    CHECK (home_pool_locked IS NULL OR home_pool_locked >= 0),

  total_pool_locked INTEGER
    CHECK (total_pool_locked IS NULL OR total_pool_locked >= 0),

  away_multiplier_locked REAL
    CHECK (
      away_multiplier_locked IS NULL
      OR away_multiplier_locked > 0
    ),

  home_multiplier_locked REAL
    CHECK (
      home_multiplier_locked IS NULL
      OR home_multiplier_locked > 0
    ),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (provider, provider_event_id),

  FOREIGN KEY (season_id)
    REFERENCES seasons(id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_markets_state_start
  ON markets(state, starts_at);

CREATE INDEX idx_markets_season_state_start
  ON markets(season_id, state, starts_at);

CREATE INDEX idx_markets_sport_state_start
  ON markets(sport, state, starts_at);


CREATE TABLE picks (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  selection TEXT NOT NULL
    CHECK (selection IN ('away', 'home')),

  wager INTEGER NOT NULL
    CHECK (wager >= 1),

  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (
      status IN (
        'PENDING_PAYMENT',
        'ACTIVE',
        'WON',
        'LOST',
        'REFUNDED',
        'CANCELLED'
      )
    ),

  final_multiplier REAL
    CHECK (
      final_multiplier IS NULL
      OR final_multiplier > 0
    ),

  payout INTEGER NOT NULL DEFAULT 0
    CHECK (payout >= 0),

  profit INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,

  UNIQUE (market_id, user_id),

  FOREIGN KEY (market_id)
    REFERENCES markets(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (user_id)
    REFERENCES users(twitch_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_picks_market_status
  ON picks(market_id, status);

CREATE INDEX idx_picks_user_created
  ON picks(user_id, created_at DESC);

CREATE INDEX idx_picks_user_status
  ON picks(user_id, status);


CREATE TABLE wallet_operations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,

  user_id TEXT NOT NULL,
  market_id TEXT,
  pick_id TEXT,

  provider TEXT NOT NULL DEFAULT 'streamelements',

  type TEXT NOT NULL
    CHECK (
      type IN (
        'WAGER_DEBIT',
        'PAYOUT_CREDIT',
        'REFUND_CREDIT',
        'COMPENSATING_REFUND'
      )
    ),

  -- Signed amount convention:
  -- wager debits are negative; all credits/refunds are positive.
  amount INTEGER NOT NULL
    CHECK (
      (type = 'WAGER_DEBIT' AND amount < 0)
      OR
      (
        type IN (
          'PAYOUT_CREDIT',
          'REFUND_CREDIT',
          'COMPENSATING_REFUND'
        )
        AND amount > 0
      )
    ),

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'CONFIRMED',
        'FAILED',
        'NEEDS_RECONCILIATION'
      )
    ),

  balance_before INTEGER
    CHECK (balance_before IS NULL OR balance_before >= 0),

  balance_after INTEGER
    CHECK (balance_after IS NULL OR balance_after >= 0),

  external_reference TEXT,

  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

  last_error TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(twitch_id)
    ON DELETE RESTRICT,

  FOREIGN KEY (market_id)
    REFERENCES markets(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (pick_id)
    REFERENCES picks(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_wallet_operations_status_created
  ON wallet_operations(status, created_at);

CREATE INDEX idx_wallet_operations_user_created
  ON wallet_operations(user_id, created_at DESC);

CREATE INDEX idx_wallet_operations_market
  ON wallet_operations(market_id);


CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  market_id TEXT NOT NULL,

  action TEXT NOT NULL
    CHECK (
      action IN (
        'SETTLE_AWAY',
        'SETTLE_HOME',
        'VOID',
        'NO_ACTION',
        'RETRY_SETTLEMENT'
      )
    ),

  result TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (admin_user_id)
    REFERENCES users(twitch_id)
    ON DELETE RESTRICT,

  FOREIGN KEY (market_id)
    REFERENCES markets(id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_admin_actions_market_created
  ON admin_actions(market_id, created_at DESC);

CREATE INDEX idx_admin_actions_admin_created
  ON admin_actions(admin_user_id, created_at DESC);


CREATE TABLE user_season_stats (
  user_id TEXT NOT NULL,
  season_id TEXT NOT NULL,

  wins INTEGER NOT NULL DEFAULT 0
    CHECK (wins >= 0),

  losses INTEGER NOT NULL DEFAULT 0
    CHECK (losses >= 0),

  settled_picks INTEGER NOT NULL DEFAULT 0
    CHECK (settled_picks >= 0),

  total_wagered INTEGER NOT NULL DEFAULT 0
    CHECK (total_wagered >= 0),

  total_returned INTEGER NOT NULL DEFAULT 0
    CHECK (total_returned >= 0),

  picks_profit INTEGER NOT NULL DEFAULT 0,

  -- Positive values can represent a win streak and negative values a
  -- loss streak. Zero means no active settled streak.
  current_streak INTEGER NOT NULL DEFAULT 0,

  best_streak INTEGER NOT NULL DEFAULT 0
    CHECK (best_streak >= 0),

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, season_id),

  FOREIGN KEY (user_id)
    REFERENCES users(twitch_id)
    ON DELETE CASCADE,

  FOREIGN KEY (season_id)
    REFERENCES seasons(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_user_season_stats_leaderboard
  ON user_season_stats(
    season_id,
    picks_profit DESC,
    wins DESC
  );
