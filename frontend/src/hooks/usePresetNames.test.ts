import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePresetNames } from './usePresetNames';
import { DEFAULT_PRESET_ORGANIZERS, STORAGE_KEY_PRESET_NAMES } from '../config';

describe('usePresetNames', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns default preset names immediately when localStorage is empty and fetch fails', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => usePresetNames());
    expect(result.current).toEqual(DEFAULT_PRESET_ORGANIZERS);
  });

  it('returns localStorage names immediately when available', () => {
    const cached = ['Alice', 'Bob'];
    localStorage.setItem(STORAGE_KEY_PRESET_NAMES, JSON.stringify(cached));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const { result } = renderHook(() => usePresetNames());
    expect(result.current).toEqual(cached);
  });

  it('updates with API names after fetch resolves', async () => {
    const apiNames = ['API User 1', 'API User 2'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(apiNames) } as any),
    );

    const { result } = renderHook(() => usePresetNames());
    await waitFor(() => {
      expect(result.current).toEqual(apiNames);
    });
  });

  it('caches API names to localStorage after successful fetch', async () => {
    const apiNames = ['Cached User'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(apiNames) } as any),
    );

    renderHook(() => usePresetNames());
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_PRESET_NAMES) ?? '[]');
      expect(stored).toEqual(apiNames);
    });
  });

  it('keeps existing names when API returns empty array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) } as any),
    );

    const { result } = renderHook(() => usePresetNames());
    await waitFor(() => {
      // Empty array from API is ignored — keeps defaults
      expect(result.current).toEqual(DEFAULT_PRESET_ORGANIZERS);
    });
  });

  it('keeps existing names when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => usePresetNames());
    await waitFor(() => {
      expect(result.current).toEqual(DEFAULT_PRESET_ORGANIZERS);
    });
  });
});
