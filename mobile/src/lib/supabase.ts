import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
}

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
