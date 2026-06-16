import { useState, useEffect } from 'react';
import { API_BASE, DEFAULT_PRESET_ORGANIZERS, STORAGE_KEY_PRESET_NAMES } from '../config';

// Returns the shared preset organiser names.
// Priority: backend API → localStorage cache → hardcoded defaults.
// Successful API responses are cached in localStorage for the next cold start.
export const usePresetNames = (): string[] => {
  const [names, setNames] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRESET_NAMES);
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_PRESET_ORGANIZERS;
  });

  useEffect(() => {
    fetch(`${API_BASE}/config/preset-names`)
      .then(r => r.json())
      .then((data: string[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setNames(data);
          localStorage.setItem(STORAGE_KEY_PRESET_NAMES, JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []);

  return names;
};
