import { useState, useEffect } from 'react';

export const useCurrentTime = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    formattedTime: time.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
    formattedDate: time.toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
};