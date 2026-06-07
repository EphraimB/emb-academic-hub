import * as fs from 'fs';
import * as path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export interface DatabaseSchema {
  availability: Record<string, { username: string; status: string; updatedAt: string }>;
  schedulerRuns: { timestamp: string; count: number }[];
}

const defaultSchema: DatabaseSchema = {
  availability: {},
  schedulerRuns: []
};

export async function initDb(): Promise<void> {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultSchema, null, 2), 'utf-8');
    console.log('Database file created and initialized.');
  } else {
    console.log('Database file loaded.');
  }
}

export function readDb(): DatabaseSchema {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    console.error('Error reading database. Using default schema.', err);
    return defaultSchema;
  }
}

export function writeDb(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to database:', err);
  }
}
