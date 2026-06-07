import * as dotenv from 'dotenv';
import { initDb } from './db/init';
import { Scheduler } from './core/scheduler';
import { checkCommuteAlerts } from './features/commute';
import { startBot } from './discord/bot';

// Load environment variables
dotenv.config();

async function main() {
  console.log('=== Starting Application ===');

  // 1. Initialize database
  await initDb();

  // 2. Initialize and start the core scheduler
  const scheduler = new Scheduler();
  
  // Register commute alerts check job to run every 5 minutes (300,000 ms)
  scheduler.registerJob({
    id: 'commute-alerts',
    intervalMs: 300000,
    execute: () => {
      checkCommuteAlerts();
    }
  });

  scheduler.start();

  // 3. Start the Discord Bot interface
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Error] DISCORD_TOKEN is missing in environment variables. Bot login skipped.');
    return;
  }

  try {
    await startBot(token);
  } catch (err) {
    console.error('[Error] Failed to start Discord Bot:', err);
  }
}

// Start orchestration
main().catch(err => {
  console.error('Fatal application error:', err);
  process.exit(1);
});
