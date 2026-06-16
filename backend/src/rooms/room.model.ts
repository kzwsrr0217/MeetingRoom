export interface Room {
  id: string;           // URL-safe slug, e.g. "mmh-sed"
  name: string;         // Display name shown on kiosk, e.g. "MMH Séd"
  calendarEmail: string; // Outlook mailbox for Graph API, e.g. "sed@company.hu"
  order: number;        // Display order (0-based)
}
