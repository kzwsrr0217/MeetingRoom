import { useCurrentTime } from '../hooks/useCurrentTime';
import type { RoomStatus } from '../hooks/useRoomStatus';

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
    </div>
  );
};
