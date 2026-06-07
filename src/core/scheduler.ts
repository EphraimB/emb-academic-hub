import { SchedulerJob } from './types';

export class Scheduler {
  private jobs: SchedulerJob[] = [];
  private intervals: NodeJS.Timeout[] = [];

  public registerJob(job: SchedulerJob): void {
    this.jobs.push(job);
  }

  public start(): void {
    console.log(`[Scheduler] Initializing scheduler with ${this.jobs.length} custom jobs...`);
    
    // Setup a default heartbeat job
    const heartbeatJob: SchedulerJob = {
      id: 'heartbeat',
      intervalMs: 60000, // Every 1 minute
      execute: () => {
        const totalJobs = this.jobs.length + 1; // Including itself
        console.log(`[Scheduler] Heartbeat check. Active jobs: ${totalJobs}`);
      }
    };
    
    // Start heartbeat immediately and run it
    const heartbeatInterval = setInterval(() => {
      heartbeatJob.execute();
    }, heartbeatJob.intervalMs);
    this.intervals.push(heartbeatInterval);

    // Start all other custom jobs
    for (const job of this.jobs) {
      console.log(`[Scheduler] Starting job: ${job.id} (runs every ${job.intervalMs}ms)`);
      const interval = setInterval(async () => {
        try {
          await job.execute();
        } catch (err) {
          console.error(`[Scheduler] Error running job ${job.id}:`, err);
        }
      }, job.intervalMs);
      this.intervals.push(interval);
    }
  }

  public stop(): void {
    console.log('[Scheduler] Stopping all jobs...');
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }
}

export interface TaskItem {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: number;
  courseName: string;
}

// Helper to parse strings like "30m", "1.5h", "1h 15m", or "45" into minutes
export function parseTimeToMinutes(input: string): number | null {
  const cleanInput = input.trim().toLowerCase();

  // Case 1: Plain digits (e.g., "45")
  if (/^\d+(\.\d+)?$/.test(cleanInput)) {
    return Math.round(parseFloat(cleanInput));
  }

  let totalMinutes = 0;
  let matched = false;

  // Match hours: "1.5h", "1h", "2 hours", "1 hr"
  const hourRegex = /(\d+(\.\d+)?)\s*(h|hour|hr|hours)/g;
  let hrMatch;
  while ((hrMatch = hourRegex.exec(cleanInput)) !== null) {
    totalMinutes += parseFloat(hrMatch[1]) * 60;
    matched = true;
  }

  // Match minutes: "30m", "15 mins", "10 min", "5 minutes"
  const minRegex = /(\d+)\s*(m|min|mins|minute|minutes)/g;
  let minMatch;
  while ((minMatch = minRegex.exec(cleanInput)) !== null) {
    totalMinutes += parseInt(minMatch[1], 10);
    matched = true;
  }

  if (matched) {
    return Math.round(totalMinutes);
  }

  return null;
}

// 0-1 Knapsack solver to maximize time-spent studying based on task priorities
export function getBestTaskCombination(availableMinutes: number, tasks: TaskItem[]): TaskItem[] {
  const n = tasks.length;
  if (n === 0 || availableMinutes <= 0) return [];

  // dp[i][w] will store the maximum value we can get with the first i tasks and weight limit w.
  // We use estimatedMinutes * priority to prioritize high priority assignments.
  const dp: number[][] = Array(n + 1).fill(0).map(() => Array(availableMinutes + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const task = tasks[i - 1];
    const weight = task.estimatedMinutes;
    const value = task.estimatedMinutes * task.priority;

    for (let w = 0; w <= availableMinutes; w++) {
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack to find the selected tasks
  const selected: TaskItem[] = [];
  let w = availableMinutes;
  for (let i = n; i > 0; i--) {
    const task = tasks[i - 1];
    const weight = task.estimatedMinutes;

    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(task);
      w -= weight;
    }
  }

  return selected.reverse();
}
