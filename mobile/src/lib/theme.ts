// Sketchbook / Hand-drawn Notebook Design System
// Warm neutral palette with pastel category accents

export const SKETCH_COLORS = {
  // Base paper tones — warm aged off-white, like a used school notebook
  paper: '#F2EAD0',        // Aged cream — warm off-white with slight yellow tint
  paperDark: '#E8DDB8',    // Darker aged cream (ruled area, card backs)
  paperLine: '#8A7040',    // Faint sepia notebook rule line color (used at low opacity)
  ink: '#1C120A',          // Very dark brown ink
  inkLight: '#4A3820',     // Medium warm brown
  inkFaint: '#8A7050',     // Faint sepia brown

  // Accent - warm tones
  amber: '#D09010',        // Warm amber/yellow highlight (deeper, less neon)
  amberLight: '#F8E080',   // Yellow highlighter (warm, not lemon)
  amberStrip: '#F5DC78',   // Torn paper strip - yellow

  // Category pastel highlighter fills (for torn paper strips)
  pastelYellow: '#FEF3A3', // Names
  pastelGreen: '#C8F5D0',  // Places
  pastelPink: '#FFD4D4',   // Animal
  pastelBlue: '#D0EAFF',   // Thing
  pastelMint: '#C8F5ED',   // Sports
  pastelLime: '#D8F5C0',   // Fruits
  pastelLavender: '#E8D5FF', // Brands
  pastelOrange: '#FFE0CC', // Health
  pastelSky: '#C8DFFF',    // Countries
  pastelPurple: '#E0CCFF', // Movies
  pastelRose: '#FFD0E8',   // Songs
  pastelTan: '#F5DEB3',    // Professions
  pastelCoral: '#FFD8C8',  // Food
  pastelGold: '#F5E0A0',   // Historical

  // Ink accent colors (slightly muted, not neon)
  red: '#CC3333',          // Stop button red marker
  redLight: '#FF6666',
  green: '#3A8A3A',
  teal: '#2A8A80',

  // Shadows / depth
  shadow: 'rgba(44, 36, 22, 0.15)', // Paper shadow - warm brown
  shadowMedium: 'rgba(44, 36, 22, 0.25)',
  shadowLight: 'rgba(44, 36, 22, 0.08)',
};

// Category color system: pastel background + deeper ink accent
export const SKETCH_CATEGORY_COLORS: Record<string, {
  strip: string;
  stripBorder: string;
  ink: string;
  inputLine: string;
}> = {
  names: {
    strip: '#FEF3A3',
    stripBorder: '#E8D840',
    ink: '#8B7A10',
    inputLine: '#C8B820',
  },
  places: {
    strip: '#C8F5D0',
    stripBorder: '#50B870',
    ink: '#2A6640',
    inputLine: '#50A860',
  },
  animal: {
    strip: '#FFD4D4',
    stripBorder: '#E07070',
    ink: '#882020',
    inputLine: '#C85050',
  },
  thing: {
    strip: '#D0EAFF',
    stripBorder: '#60A8E0',
    ink: '#205880',
    inputLine: '#5090C8',
  },
  sports_games: {
    strip: '#C8DFFF',
    stripBorder: '#5080D8',
    ink: '#204080',
    inputLine: '#4878C8',
  },
  brands: {
    strip: '#F0D8FF',
    stripBorder: '#B878D8',
    ink: '#602880',
    inputLine: '#A060C8',
  },
  health_issues: {
    strip: '#FFE0CC',
    stripBorder: '#E07040',
    ink: '#882010',
    inputLine: '#C85030',
  },
  countries: {
    strip: '#C8DFFF',
    stripBorder: '#4878D0',
    ink: '#183070',
    inputLine: '#4070B8',
  },
  professions: {
    strip: '#F5E0A0',
    stripBorder: '#C8A030',
    ink: '#705010',
    inputLine: '#B89028',
  },
  food_dishes: {
    strip: '#FFD8C8',
    stripBorder: '#E06040',
    ink: '#882010',
    inputLine: '#C85030',
  },
  celebrities: {
    strip: '#F0E0A0',
    stripBorder: '#C09030',
    ink: '#604010',
    inputLine: '#A87828',
  },
};
