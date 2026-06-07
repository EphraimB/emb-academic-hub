import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.sqlite');

export let db: Database.Database;

export async function initDb(): Promise<void> {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Initialize SQLite database
  db = new Database(DB_FILE);

  // Enable foreign key support
  db.pragma('foreign_keys = ON');

  // Create semesters table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `).run();

  // Create courses table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      semesterId TEXT NOT NULL,
      name TEXT NOT NULL,
      meetingDays TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      location TEXT,
      FOREIGN KEY(semesterId) REFERENCES semesters(id) ON DELETE CASCADE
    )
  `).run();

  console.log('[Database] SQLite initialized and tables verified.');
}
