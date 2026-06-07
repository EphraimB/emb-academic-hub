import { readDb, writeDb } from './init';

export function setUserAvailability(userId: string, username: string, status: string): void {
  const db = readDb();
  db.availability[userId] = {
    username,
    status,
    updatedAt: new Date().toISOString()
  };
  writeDb(db);
}

export function getUserAvailability(userId: string) {
  const db = readDb();
  return db.availability[userId] || null;
}

export function getAllAvailability() {
  const db = readDb();
  return db.availability;
}

export function logSchedulerRun(count: number): void {
  const db = readDb();
  db.schedulerRuns.push({
    timestamp: new Date().toISOString(),
    count
  });
  
  // Keep logs limited to avoid indefinite JSON file growth
  if (db.schedulerRuns.length > 50) {
    db.schedulerRuns.shift();
  }
  
  writeDb(db);
}
