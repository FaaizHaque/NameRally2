/**
 * Single source of truth for all category colors.
 * Rules:
 *  - No reds (looks like wrong-answer feedback)
 *  - Each category gets a clearly distinct hue
 *  - Greens spread across teal / lime / mid-green (no triple green)
 *  - Gradients provided for card backgrounds
 */

import type { CategoryType } from './state/game-store';

export interface CatColor {
  // Core accent — works standalone (border, icon, pill)
  accent: string;

  // Light / notebook theme
  tab: string;       // Very light tinted bg for chips/tabs
  border: string;    // Border on light bg
  icon: string;      // Icon color on light bg (dark for contrast)

  // Dark theme (single player level mode)
  darkBg: string;    // Dark card bg (tinted)
  darkBorder: string;
  darkAccent: string; // Bright on dark bg

  // Gradient pair (use as LinearGradient colors[0..1])
  gradA: string;     // Start (lighter/vivid)
  gradB: string;     // End (darker/richer)
}

export const CAT_COLORS: Record<CategoryType, CatColor> = {
  names: {
    accent: '#F59E0B',
    tab: '#FEF3C7', border: '#F59E0B', icon: '#92400E',
    darkBg: '#1C1200', darkBorder: '#F59E0B', darkAccent: '#FDE68A',
    gradA: '#F59E0B', gradB: '#D97706',
  },
  places: {
    accent: '#0D9488',
    tab: '#CCFBF1', border: '#0D9488', icon: '#134E4A',
    darkBg: '#001A18', darkBorder: '#14B8A6', darkAccent: '#99F6E4',
    gradA: '#14B8A6', gradB: '#0D9488',
  },
  animal: {
    // Orange — warm, nature, clearly NOT red
    accent: '#F97316',
    tab: '#FFEDD5', border: '#F97316', icon: '#7C2D12',
    darkBg: '#1A0C00', darkBorder: '#FB923C', darkAccent: '#FED7AA',
    gradA: '#FB923C', gradB: '#F97316',
  },
  thing: {
    accent: '#3B82F6',
    tab: '#DBEAFE', border: '#3B82F6', icon: '#1E3A8A',
    darkBg: '#00101E', darkBorder: '#60A5FA', darkAccent: '#BFDBFE',
    gradA: '#60A5FA', gradB: '#3B82F6',
  },
  sports_games: {
    accent: '#7C3AED',
    tab: '#EDE9FE', border: '#7C3AED', icon: '#3B0764',
    darkBg: '#120028', darkBorder: '#A78BFA', darkAccent: '#DDD6FE',
    gradA: '#A78BFA', gradB: '#7C3AED',
  },
  brands: {
    accent: '#DB2777',
    tab: '#FCE7F3', border: '#DB2777', icon: '#831843',
    darkBg: '#1A001A', darkBorder: '#F472B6', darkAccent: '#FBCFE8',
    gradA: '#F472B6', gradB: '#DB2777',
  },
  health_issues: {
    // Deep amber — medical/alert but not red
    accent: '#D97706',
    tab: '#FEF9C3', border: '#D97706', icon: '#713F12',
    darkBg: '#1A1000', darkBorder: '#FCD34D', darkAccent: '#FEF08A',
    gradA: '#FCD34D', gradB: '#D97706',
  },
  countries: {
    accent: '#0284C7',
    tab: '#E0F2FE', border: '#0284C7', icon: '#0C4A6E',
    darkBg: '#001828', darkBorder: '#38BDF8', darkAccent: '#BAE6FD',
    gradA: '#38BDF8', gradB: '#0284C7',
  },
  movies: {
    accent: '#6366F1',
    tab: '#EEF2FF', border: '#6366F1', icon: '#312E81',
    darkBg: '#0C0A20', darkBorder: '#818CF8', darkAccent: '#C7D2FE',
    gradA: '#818CF8', gradB: '#6366F1',
  },
  songs: {
    // Fuchsia/magenta — distinct from brands pink and movies indigo
    accent: '#D946EF',
    tab: '#FAE8FF', border: '#D946EF', icon: '#701A75',
    darkBg: '#1A0020', darkBorder: '#E879F9', darkAccent: '#F5D0FE',
    gradA: '#E879F9', gradB: '#D946EF',
  },
  professions: {
    accent: '#CA8A04',
    tab: '#FEF9C3', border: '#CA8A04', icon: '#713F12',
    darkBg: '#181200', darkBorder: '#FDE047', darkAccent: '#FEF9C3',
    gradA: '#FBBF24', gradB: '#CA8A04',
  },
  food_dishes: {
    // Deep orange — rustic warmth, distinct from animal's brighter orange
    accent: '#EA580C',
    tab: '#FFF7ED', border: '#EA580C', icon: '#7C2D12',
    darkBg: '#1A0800', darkBorder: '#FB923C', darkAccent: '#FED7AA',
    gradA: '#FB923C', gradB: '#EA580C',
  },
  historical_figures: {
    // Bronze/copper — antiquity, clearly not green
    accent: '#B45309',
    tab: '#FEF3C7', border: '#B45309', icon: '#78350F',
    darkBg: '#1A0E00', darkBorder: '#D97706', darkAccent: '#FDE68A',
    gradA: '#D97706', gradB: '#B45309',
  },
  music_artists: {
    // Lime — modern/electric, clearly distinct from mid-green fruits
    accent: '#65A30D',
    tab: '#ECFCCB', border: '#65A30D', icon: '#1A2E05',
    darkBg: '#0C1800', darkBorder: '#A3E635', darkAccent: '#D9F99D',
    gradA: '#A3E635', gradB: '#65A30D',
  },
  fruits_vegetables: {
    // Mid green — fresh produce, the one true green
    accent: '#16A34A',
    tab: '#DCFCE7', border: '#16A34A', icon: '#14532D',
    darkBg: '#001A0C', darkBorder: '#4ADE80', darkAccent: '#BBF7D0',
    gradA: '#4ADE80', gradB: '#16A34A',
  },
};
