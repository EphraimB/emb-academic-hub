import { setUserAvailability, getUserAvailability } from '../db/queries';

export interface CommutePreference {
  userId: string;
  username: string;
  status: 'available' | 'busy' | 'away';
}

export function updateCommuteStatus(userId: string, username: string, status: 'available' | 'busy' | 'away'): void {
  console.log(`[Feature - Commute] Updating commute status for user ${username} (${userId}) to ${status}`);
  setUserAvailability(userId, username, status);
}

export function checkCommuteAlerts(): void {
  console.log('[Feature - Commute] Checking for any pending commute alerts...');
}
