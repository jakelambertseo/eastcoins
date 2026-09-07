-- EastCoin Picks
-- Migration 0002: moneyline pricing + settlement provenance
--
-- Migration 0001 modelled the retired community-pool product: markets
-- carry away/home POOL and MULTIPLIER columns and nothing else. Picks
-- now prices from sportsbook moneylines that are locked when a market
-- opens, so there is nowhere to record the price a pick was taken at.
--
-- This migration is purely additive. It adds columns and one table;
-- it drops nothing and rewrites no existing rows, so it is safe to
-- apply to a live database.

-- ---------------------------------------------------------------- markets

-- The American line each side was locked at when the market opened.
-- Integers, e.g. -150 and +130. Everyone betting a market gets these
-- same two numbers regardless of when they place the pick.
ALTER TABLE markets ADD COLUMN away_odds_locked INTEGER;
ALTER TABLE markets ADD COLUMN home_odds_locked INTEGER;
ALTER TABLE markets ADD COLUMN odds_locked_at TEXT;

-- Where the settlement decision came from, and what it saw. Kept so a
-- disputed payout can be traced back to the exact scoreline that
-- caused it rather than being re-derived later.
ALTER TABLE markets ADD COLUMN settlement_source TEXT;
ALTER TABLE markets ADD COLUMN settlement_detail TEXT;
ALTER TABLE markets ADD COLUMN final_away_score INTEGER;
ALTER TABLE markets ADD COLUMN final_home_score INTEGER;

-- ---------------------------------------------------------------- picks

-- The line this pick was taken at, stored on the pick itself. The
-- market's locked odds should never change, but settlement must not
-- depend on that assumption: a pick is always graded at the price the
-- bettor was actually shown.
ALTER TABLE picks ADD COLUMN odds_locked INTEGER;

-- ---------------------------------------------------------------- season

-- Nothing can be created without an active season, and 0001 seeds
-- none. One is inserted here so markets have somewhere to attach.
INSERT OR IGNORE INTO seasons (id, name, active)
VALUES ('2026', '2026 Season', 1);
