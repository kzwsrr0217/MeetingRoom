export const ROOMS = [
  'MMH Séd',
  'MMH Balaton',
  'MMH Mars',
  'MMH Tihany',
  'MMH Bakony',
  'MMH Kis Balaton',
];

// Default preset organizer names shown in the booking modal quick-pick.
// Admins can override these per-browser via the /admin page (saved in localStorage).
export const DEFAULT_PRESET_ORGANIZERS = [
  'Kovács Péter',
  'Nagy Anna',
  'Horváth Béla',
  'Kiss Eszter',
];

export const STORAGE_KEY_HOME_ROOM = 'meetingroom_home';
export const STORAGE_KEY_PRESET_NAMES = 'meetingroom_preset_names';

// VITE_API_URL: set for production builds (e.g. Railway backend URL).
// In dev/Codespaces: leave unset — Vite proxies /api to localhost:3000.
export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';
