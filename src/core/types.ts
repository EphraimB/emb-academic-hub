export interface SchedulerJob {
  id: string;
  intervalMs: number;
  execute: () => Promise<void> | void;
}
