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
      name TEXT NOT NULL,
      isCurrent INTEGER NOT NULL DEFAULT 0 CHECK (isCurrent IN (0, 1)),
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0, 1))
    )
  `).run();

  // Run self-migration check for existing databases that lack the new columns
  try {
    const tableInfo = db.pragma('table_info(semesters)') as { name: string }[];
    const hasIsCurrent = tableInfo.some(col => col.name === 'isCurrent');
    if (!hasIsCurrent) {
      db.prepare('ALTER TABLE semesters ADD COLUMN isCurrent INTEGER NOT NULL DEFAULT 0 CHECK (isCurrent IN (0, 1))').run();
      db.prepare('ALTER TABLE semesters ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0, 1))').run();
      console.log('[Database] Migrated semesters table structure successfully.');
    }
  } catch (err) {
    console.error('[Database] Failed to migrate semesters table columns:', err);
  }

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

  // Create assignments table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL,
      title TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      priority INTEGER NOT NULL,
      FOREIGN KEY(courseId) REFERENCES courses(id) ON DELETE CASCADE
    )
  `).run();

  // Create tasks table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      assignmentId TEXT NOT NULL,
      title TEXT NOT NULL,
      estimatedMinutes INTEGER NOT NULL,
      completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
      FOREIGN KEY(assignmentId) REFERENCES assignments(id) ON DELETE CASCADE
    )
  `).run();

  console.log('[Database] SQLite initialized and all tables verified.');
}
