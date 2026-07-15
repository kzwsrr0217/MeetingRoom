import { useCurrentTime } from '../hooks/useCurrentTime';
import type { RoomStatus } from '../hooks/useRoomStatus';
import { useI18n } from '../i18n/I18nContext';

const hm = (d: Date) => d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

export const MeetingDetails = ({ status }: { status: RoomStatus }) => {
  const { t } = useI18n();
  useCurrentTime(); // re-renders every second for live countdown

  if (status.isOccupied) {
    const endTime = status.currentMeetingEnd ? new Date(status.currentMeetingEnd) : null;
    const minutesLeft = endTime ? Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 60000)) : null;
    const title = status.currentMeetingPrivate ? t('meeting.private') : (status.currentMeetingTitle || t('meeting.private'));

    return (
      <div className="mt-10">
        <h3 className="text-2xl text-gray-500 uppercase tracking-widest mb-4">{t('meeting.current')}</h3>
        <p className="text-6xl font-semibold text-white leading-tight">{title}</p>
        {status.currentMeetingOrganizer && (
          <p className="text-3xl text-gray-300 mt-4 font-medium">
            {t('common.organizer')}: {status.currentMeetingOrganizer}
          </p>
        )}
        {endTime && (
          <div className="mt-6 flex items-center gap-6">
            <p className="text-2xl text-gray-400">
              {t('meeting.ends')} <span className="text-white font-bold">{hm(endTime)}</span>
            </p>
            {minutesLeft !== null && (
              <span className={`px-4 py-2 rounded-xl text-lg font-black uppercase tracking-wide ${
                minutesLeft <= 5
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'bg-gray-800 text-gray-300'
              }`}>
                {t('meeting.minutes_left', { n: minutesLeft })}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h3 className="text-2xl text-gray-500 uppercase tracking-widest mb-4">{t('meeting.next')}</h3>
      {status.nextMeetingStart ? (
        <p className="text-5xl font-medium text-gray-200">
          {t('meeting.starts_at', { time: hm(new Date(status.nextMeetingStart)) })}
        </p>
      ) : (
        <p className="text-5xl font-medium text-gray-600 italic">{t('meeting.no_more')}</p>
      )}
    </div>
  );
};
