import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRooms, useRoomNames } from './useRooms';
import { ROOMS } from '../config';

describe('useRooms', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns static fallback rooms immediately before fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useRooms());
    // Static fallback is set in useState initializer — no async wait needed
    expect(result.current).toHaveLength(ROOMS.length);
    expect(result.current[0].name).toBe(ROOMS[0]);
  });

  it('fallback rooms have id, name, calendarEmail, and order fields', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useRooms());
    const first = result.current[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('calendarEmail');
    expect(first).toHaveProperty('order');
  });

  it('updates with API rooms after fetch resolves', async () => {
    const apiRooms = [
      { id: 'api-room', name: 'API Room', calendarEmail: 'api@test.hu', order: 0 },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(apiRooms) } as any),
    );

    const { result } = renderHook(() => useRooms());
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('API Room');
      expect(result.current[0].calendarEmail).toBe('api@test.hu');
    });
  });

  it('keeps static fallback when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useRooms());
    await waitFor(() => {
      expect(result.current).toHaveLength(ROOMS.length);
    });
  });

  it('keeps static fallback when API returns invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error('bad json')) } as any),
    );
    const { result } = renderHook(() => useRooms());
    await waitFor(() => {
      expect(result.current).toHaveLength(ROOMS.length);
    });
  });
});

describe('useRoomNames', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns room names as strings from static fallback', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useRoomNames());
    expect(result.current).toEqual(ROOMS);
  });

  it('returns names only (not full room objects)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useRoomNames());
    expect(result.current.every(name => typeof name === 'string')).toBe(true);
  });

  it('updates names after API fetch resolves', async () => {
    const apiRooms = [{ id: 'x', name: 'From API', calendarEmail: '', order: 0 }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(apiRooms) } as any),
    );
    const { result } = renderHook(() => useRoomNames());
    await waitFor(() => {
      expect(result.current).toEqual(['From API']);
    });
  });
});
