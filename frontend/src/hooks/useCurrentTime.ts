import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

export const useCurrentTime = () => {
  const { locale } = useI18n();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    formattedTime: time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    formattedDate: time.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
  };
};
