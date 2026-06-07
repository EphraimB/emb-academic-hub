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
