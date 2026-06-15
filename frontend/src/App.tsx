// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import './index.css';
import { useRoomStatus } from './hooks/useRoomStatus';
import { RoomDisplay } from './components/RoomDisplay';

function App() {
  const HOME_ROOM = "MMH Séd"; // A tablet fix helyszíne

  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get('room');
  
  const currentRoomName = roomFromUrl || HOME_ROOM;
  const isViewingOtherRoom = currentRoomName !== HOME_ROOM;

  const { status, error, bookRoom } = useRoomStatus(currentRoomName);

  // Automata visszaváltás 60 mp után
  useEffect(() => {
    if (isViewingOtherRoom) {
      const timer = setTimeout(() => {
        window.location.search = `?room=${encodeURIComponent(HOME_ROOM)}`;
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [isViewingOtherRoom]);

  // JAVÍTÁS: A 'handleBooking' wrapper-t töröltük, 
  // mert a hook-ból jövő 'bookRoom' már pontosan tudja fogadni a paramétereket.

  if (error) return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center p-10 text-center">
      <div className="bg-red-900/20 border border-red-500 p-10 rounded-3xl">
        <h1 className="text-red-500 text-3xl font-black uppercase mb-4">Hiba</h1>
        <p className="text-white/60">{error}</p>
      </div>
    </div>
  );

  if (!status) return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white font-bold tracking-widest uppercase animate-pulse">Szinkronizálás...</p>
    </div>
  );

  return (
    <>
      {isViewingOtherRoom && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-blue-600 text-white py-3 px-10 flex justify-between items-center shadow-2xl animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <span className="text-2xl">⚠️</span>
            <p className="font-bold uppercase tracking-tight">
              Figyelem: Most a <span className="underline">{currentRoomName}</span> állapotát látod!
            </p>
          </div>
          <button 
            onClick={() => window.location.search = `?room=${encodeURIComponent(HOME_ROOM)}`}
            className="bg-white text-blue-600 px-6 py-2 rounded-xl font-black uppercase text-sm hover:bg-gray-100 transition-colors"
          >
            Vissza az alapértelmezetthez
          </button>
        </div>
      )}

      {/* JAVÍTÁS: onBookNow helyett onBookRoom, és egyből a bookRoom-ot adjuk át */}
      <RoomDisplay 
        status={status} 
        roomName={currentRoomName} 
        onBookRoom={bookRoom}
      />
    </>
  );
}

export default App;