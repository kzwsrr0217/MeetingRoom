import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Auto-reload the kiosk after this many ms so an unattended panel recovers itself. */
  autoReloadMs?: number;
}
interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Catches render/runtime errors anywhere below it so a single bad render can't
 * leave an unattended kiosk on a blank screen. Shows a friendly message and, on
 * a kiosk, reloads itself after a short delay.
 */
export class ErrorBoundary extends Component<Props, State> {
  private timer?: ReturnType<typeof setTimeout>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary] Kioszk hiba:', error);
    const delay = this.props.autoReloadMs ?? 30000;
    this.timer = setTimeout(() => window.location.reload(), delay);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center gap-6 p-10 text-center cursor-pointer"
        onClick={() => window.location.reload()}
      >
        <div className="text-6xl">🔄</div>
        <h1 className="text-white text-3xl font-black uppercase tracking-tight">Újraindítás…</h1>
        <p className="text-white/50 max-w-md">
          Váratlan hiba történt a kijelzőn. A rendszer automatikusan újratölt — vagy érintse meg a képernyőt.
        </p>
      </div>
    );
  }
}
