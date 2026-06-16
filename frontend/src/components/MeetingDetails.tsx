import { useCurrentTime } from '../hooks/useCurrentTime';
import type { RoomStatus } from '../hooks/useRoomStatus';

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

const UpcomingList = ({ schedule }: { schedule: RoomStatus['schedule'] }) => {
  const now = Date.now();

  // Events that start in the future, next 4 hours, max 3
  const upcoming = schedule
    .filter(e => new Date(e.start).getTime() > now)
    .filter(e => new Date(e.start).getTime() - now < 4 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg text-gray-600 uppercase tracking-widest mb-3 font-bold">
        Következő foglalások
      </h3>
      <div className="flex flex-col gap-2">
        {upcoming.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3 bg-gray-800/50 rounded-2xl border border-gray-700/50"
          >
            <span className="text-white font-black text-lg tabular-nums min-w-20">
              {fmt(e.start)}–{fmt(e.end)}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-white/90 font-semibold text-base truncate">
                {e.title}
              </span>
              <span className="text-gray-500 text-sm truncate">{e.organizer}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MeetingDetails = ({ status }: { status: RoomStatus }) => {
  useCurrentTime(); // re-renders every second for live countdown

  if (status.isOccupied) {
    const endTime = status.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
    const minutesLeft = endTime ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000)) : null;

    return (
      <div className="mt-10">
        <h3 className="text-2xl text-gray-500 uppercase tracking-widest mb-4">Jelenlegi Esemény</h3>
        <p className="text-6xl font-semibold text-white leading-tight">
          {status.currentMeetingTitle || 'Privát megbeszélés'}
        </p>
        {status.currentMeetingOrganizer && (
          <p className="text-3xl text-gray-300 mt-4 font-medium">
            Szervező: {status.currentMeetingOrganizer}
          </p>
        )}
        {endTime && (
          <div className="mt-6 flex items-center gap-6">
            <p className="text-2xl text-gray-400">
              Vége: <span className="text-white font-bold">
                {endTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            {minutesLeft !== null && (
              <span className={`px-4 py-2 rounded-xl text-lg font-black uppercase tracking-wide ${
                minutesLeft <= 5
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'bg-gray-800 text-gray-300'
              }`}>
                Még {minutesLeft} perc
              </span>
            )}
          </div>
        )}
        <UpcomingList schedule={status.schedule} />
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h3 className="text-2xl text-gray-500 uppercase tracking-widest mb-4">Következő Esemény</h3>
      {status.nextMeetingStart ? (
        <p className="text-5xl font-medium text-gray-200">
          {new Date(status.nextMeetingStart).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
          -tól kezdődik
        </p>
      ) : (
        <p className="text-5xl font-medium text-gray-600 italic">A mai napra nincs több foglalás.</p>
      )}
      <UpcomingList schedule={status.schedule} />
    </div>
  );
};
