export class RoomStatus {
  roomId: string;
  isOccupied: boolean;
  currentMeetingTitle: string | null;
  currentMeetingOrganizer: string | null;
  currentMeetingEnd: string | null;
  nextMeetingStart: string | null;
  schedule: { start: string; end: string; title: string; organizer: string }[];
}