import { useCurrentTime } from '../hooks/useCurrentTime';

export const Header = () => {
  const { formattedTime, formattedDate } = useCurrentTime();

  return (
    <div className="flex flex-col">
      <h1 className="text-8xl font-light tracking-wider">{formattedTime}</h1>
      <p className="text-2xl text-gray-400 mt-2 capitalize">{formattedDate}</p>
    </div>
  );
};