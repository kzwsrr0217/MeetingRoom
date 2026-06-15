import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetupScreen } from './SetupScreen';
import { ROOMS, STORAGE_KEY_HOME_ROOM } from '../config';

describe('SetupScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    // Suppress window.location navigation errors in jsdom
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('renders heading and subheading', () => {
    render(<SetupScreen />);
    expect(screen.getByText(/Melyik tárgyaló/i)).toBeInTheDocument();
    expect(screen.getByText(/Válassza ki/i)).toBeInTheDocument();
  });

  it('renders a button for every room in config', () => {
    render(<SetupScreen />);
    for (const room of ROOMS) {
      expect(screen.getByRole('button', { name: room })).toBeInTheDocument();
    }
  });

  it('saves selected room to localStorage', () => {
    render(<SetupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'MMH Séd' }));
    expect(localStorage.getItem(STORAGE_KEY_HOME_ROOM)).toBe('MMH Séd');
  });

  it('saves a different room when that button is clicked', () => {
    render(<SetupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'MMH Balaton' }));
    expect(localStorage.getItem(STORAGE_KEY_HOME_ROOM)).toBe('MMH Balaton');
  });
});
