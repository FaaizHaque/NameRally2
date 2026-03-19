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
    tab: '#FEF3C7', border: '#F59E0B', icon: '#D97706',
    darkBg: '#1C1200', darkBorder: '#F59E0B', darkAccent: '#FDE68A',
    gradA: '#F59E0B', gradB: '#D97706',
  },
  places: {
    accent: '#0D9488',
    tab: '#CCFBF1', border: '#0D9488', icon: '#0D9488',
    darkBg: '#001A18', darkBorder: '#14B8A6', darkAccent: '#99F6E4',
    gradA: '#14B8A6', gradB: '#0D9488',
  },
  animal: {
    // Orange — warm, nature, clearly NOT red
    accent: '#F97316',
    tab: '#FFEDD5', border: '#F97316', icon: '#EA580C',
    darkBg: '#1A0C00', darkBorder: '#FB923C', darkAccent: '#FED7AA',
    gradA: '#FB923C', gradB: '#F97316',
  },
  thing: {
    accent: '#3B82F6',
    tab: '#DBEAFE', border: '#3B82F6', icon: '#2563EB',
    darkBg: '#00101E', darkBorder: '#60A5FA', darkAccent: '#BFDBFE',
    gradA: '#60A5FA', gradB: '#3B82F6',
  },
  sports_games: {
    accent: '#7C3AED',
    tab: '#EDE9FE', border: '#7C3AED', icon: '#7C3AED',
    darkBg: '#120028', darkBorder: '#A78BFA', darkAccent: '#DDD6FE',
    gradA: '#A78BFA', gradB: '#7C3AED',
  },
  brands: {
    accent: '#DB2777',
    tab: '#FCE7F3', border: '#DB2777', icon: '#DB2777',
    darkBg: '#1A001A', darkBorder: '#F472B6', darkAccent: '#FBCFE8',
    gradA: '#F472B6', gradB: '#DB2777',
  },
  health_issues: {
    // Rose/berry — medical cross, clearly distinct from amber/yellow
    accent: '#F43F5E',
    tab: '#FFE4E6', border: '#F43F5E', icon: '#E11D48',
    darkBg: '#1A0008', darkBorder: '#FB7185', darkAccent: '#FECDD3',
    gradA: '#FB7185', gradB: '#F43F5E',
  },
  countries: {
    accent: '#0284C7',
    tab: '#E0F2FE', border: '#0284C7', icon: '#0284C7',
    darkBg: '#001828', darkBorder: '#38BDF8', darkAccent: '#BAE6FD',
    gradA: '#38BDF8', gradB: '#0284C7',
  },
  professions: {
    // Cyan — professional/corporate, completely different hue from amber health_issues
    accent: '#0891B2',
    tab: '#CFFAFE', border: '#0891B2', icon: '#0891B2',
    darkBg: '#001C24', darkBorder: '#22D3EE', darkAccent: '#A5F3FC',
    gradA: '#22D3EE', gradB: '#0891B2',
  },
  food_dishes: {
    // Deep orange — rustic warmth, distinct from animal's brighter orange
    accent: '#EA580C',
    tab: '#FFF7ED', border: '#EA580C', icon: '#EA580C',
    darkBg: '#1A0800', darkBorder: '#FB923C', darkAccent: '#FED7AA',
    gradA: '#FB923C', gradB: '#EA580C',
  },
  historical_figures: {
    // Bronze/copper — antiquity, clearly not green
    accent: '#B45309',
    tab: '#FEF3C7', border: '#B45309', icon: '#B45309',
    darkBg: '#1A0E00', darkBorder: '#D97706', darkAccent: '#FDE68A',
    gradA: '#D97706', gradB: '#B45309',
  },
  fruits_vegetables: {
    // Mid green — fresh produce, the one true green
    accent: '#16A34A',
    tab: '#DCFCE7', border: '#16A34A', icon: '#16A34A',
    darkBg: '#001A0C', darkBorder: '#4ADE80', darkAccent: '#BBF7D0',
    gradA: '#4ADE80', gradB: '#16A34A',
  },
};
