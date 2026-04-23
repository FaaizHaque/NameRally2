import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
}

// TODO post-launch: lock down multiplayer RLS using Supabase anonymous auth so only app-authenticated users can write to game_sessions and players tables
// TODO post-launch: route daily_challenge_scores inserts through Railway backend to validate scores server-side before writing, preventing direct API abuse

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types
export interface DbGameSession {
  id: string;
  code: string;
  host_id: string;
  status: 'lobby' | 'picking_letter' | 'playing' | 'round_results' | 'final_results';
  current_round: number;
  current_letter: string;
  total_rounds: number;
  selected_categories: string[];
  round_duration: number;
  round_start_time: number | null;
  stop_requested: boolean;
  stop_requested_by: string | null;
  stop_countdown_start: number | null;
  created_at: string;
}

export interface DbPlayer {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  is_host: boolean;
  is_ready: boolean;
  total_score: number;
  current_round_answers: Record<string, string>;
  has_submitted: boolean;
  created_at: string;
}

export interface DbRoundResult {
  id: string;
  session_id: string;
  round_number: number;
  letter: string;
  player_scores: Record<string, number>;
  answers: Record<string, Record<string, { answer: string; score: number; isValid: boolean }>>;
  created_at: string;
}

/**
 * Daily Challenge Leaderboard entry.
 *
 * Required Supabase SQL (run once in the SQL Editor):
 *
 * create table if not exists daily_challenge_scores (
 *   id uuid primary key default gen_random_uuid(),
 *   challenge_date text not null,
 *   username text not null,
 *   total_score integer not null,
 *   total_time_ms integer not null,
 *   correct_count integer not null,
 *   completed_at bigint not null,
 *   created_at timestamp with time zone default now(),
 *   unique(challenge_date, username)
 * );
 *
 * -- Enable Row Level Security (allow public reads, authenticated writes)
 * alter table daily_challenge_scores enable row level security;
 * create policy "Anyone can read scores" on daily_challenge_scores for select using (true);
 * create policy "Anyone can insert scores" on daily_challenge_scores for insert with check (true);
 * create policy "Users can update own score" on daily_challenge_scores for update using (true);
 */
export interface DbDailyChallengeScore {
  id?: string;
  challenge_date: string;   // YYYY-MM-DD
  username: string;
  total_score: number;
  total_time_ms: number;
  correct_count: number;
  completed_at: number;     // Unix timestamp ms
  created_at?: string;
}
