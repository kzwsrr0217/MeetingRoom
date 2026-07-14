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
export const STORAGE_KEY_ADMIN_KEY = 'meetingroom_admin_key';

// ── Polling intervals (single source of truth) ───────────────────────────────
export const STATUS_POLL_MS = 15000;        // kiosk room-status refresh
export const ADMIN_STATUS_POLL_MS = 15000;  // admin live grid + health
export const ROOMS_POLL_MS = 5 * 60 * 1000; // propagate admin room changes to kiosks

// VITE_API_URL: set for production builds where the API lives on another origin.
// Leave unset when a reverse proxy (nginx/Vite) serves /api same-origin.
export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Admin secret for mutating endpoints. Stored per-browser; sent as x-admin-key.
// Only required when the backend has ADMIN_API_KEY configured (see AdminKeyGuard).
export const getAdminKey = (): string =>
  (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_ADMIN_KEY)) || '';

export const adminHeaders = (): Record<string, string> => {
  const key = getAdminKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'x-admin-key': key } : {}),
  };
};
