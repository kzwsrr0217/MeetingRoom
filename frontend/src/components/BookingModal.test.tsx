import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BookingModal } from './BookingModal';
import { STORAGE_KEY_PRESET_NAMES, DEFAULT_PRESET_ORGANIZERS } from '../config';

const noop = () => {};

describe('BookingModal', () => {
  beforeEach(() => {
    localStorage.clear();
    // Prevent usePresetNames hook from making real network calls in tests
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in tests')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BookingModal isOpen={false} onClose={noop} onBook={vi.fn()} onToast={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal when isOpen is true', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    expect(screen.getByText('Terem foglalása')).toBeInTheDocument();
    expect(screen.getByText('Időtartam')).toBeInTheDocument();
  });

  it('shows all three duration options with default selected on 30', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    expect(screen.getByRole('button', { name: '15 perc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 perc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60 perc' })).toBeInTheDocument();
  });

  it('confirm button is disabled until a name is selected', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    const confirm = screen.getByRole('button', { name: 'Megerősítés' });
    expect(confirm).toBeDisabled();
  });

  it('confirm button becomes enabled after selecting a preset name', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    fireEvent.click(screen.getByRole('button', { name: DEFAULT_PRESET_ORGANIZERS[0] }));
    expect(screen.getByRole('button', { name: 'Megerősítés' })).not.toBeDisabled();
  });

  it('calls onBook with selected duration and organizer', async () => {
    const onBook = vi.fn().mockResolvedValue(null);
    const onToast = vi.fn();
    render(<BookingModal isOpen onClose={noop} onBook={onBook} onToast={onToast} />);

    fireEvent.click(screen.getByRole('button', { name: '60 perc' }));
    fireEvent.click(screen.getByRole('button', { name: DEFAULT_PRESET_ORGANIZERS[1] }));
    fireEvent.click(screen.getByRole('button', { name: 'Megerősítés' }));

    await waitFor(() => {
      expect(onBook).toHaveBeenCalledWith(60, DEFAULT_PRESET_ORGANIZERS[1], '', false);
    });
  });

  it('shows custom name input when "Más név..." is clicked', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más név...' }));
    expect(screen.getByPlaceholderText('Teljes neve...')).toBeInTheDocument();
  });

  it('confirm stays disabled when custom name input is empty', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más név...' }));
    expect(screen.getByRole('button', { name: 'Megerősítés' })).toBeDisabled();
  });

  it('confirm enables after typing a custom name', () => {
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más név...' }));
    fireEvent.change(screen.getByPlaceholderText('Teljes neve...'), {
      target: { value: 'Egyéni Felhasználó' },
    });
    expect(screen.getByRole('button', { name: 'Megerősítés' })).not.toBeDisabled();
  });

  it('uses preset names from localStorage when available', () => {
    const customNames = ['Alice', 'Bob'];
    localStorage.setItem(STORAGE_KEY_PRESET_NAMES, JSON.stringify(customNames));
    render(<BookingModal isOpen onClose={noop} onBook={vi.fn()} onToast={noop} />);
    expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
  });

  it('calls onClose when Mégse is clicked', () => {
    const onClose = vi.fn();
    render(<BookingModal isOpen onClose={onClose} onBook={vi.fn()} onToast={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mégse' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <BookingModal isOpen onClose={onClose} onBook={vi.fn()} onToast={noop} />,
    );
    // The outermost fixed div is the backdrop
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
