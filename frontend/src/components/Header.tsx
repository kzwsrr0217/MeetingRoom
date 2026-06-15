import { useRef } from 'react';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { STORAGE_KEY_HOME_ROOM } from '../config';

export const Header = () => {
  const { formattedTime, formattedDate } = useCurrentTime();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY_HOME_ROOM);
      window.location.href = '/';
    }, 3000);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div
      className="flex flex-col"
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
    >
      <h1 className="text-8xl font-light tracking-wider">{formattedTime}</h1>
      <p className="text-2xl text-gray-400 mt-2 capitalize">{formattedDate}</p>
    </div>
  );
};
