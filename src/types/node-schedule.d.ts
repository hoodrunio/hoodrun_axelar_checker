declare module 'node-schedule' {
    export interface Job {
      name: string;
      job: () => void;
      cancel: () => void;
      reschedule: (spec: RecurrenceRule | string) => void;
      nextInvocation: () => Date;
    }
  
    export interface RecurrenceRule {
      year?: number | number[];
      month?: number | number[];
      date?: number | number[];
      dayOfWeek?: number | number[];
      hour?: number | number[];
      minute?: number | number[];
      second?: number | number[];
      tz?: string;
    }
  
    export function scheduleJob(
      name: string,
      rule: RecurrenceRule | string,
      callback: () => void
    ): Job;
  
    export function scheduleJob(
      rule: RecurrenceRule | string,
      callback: () => void
    ): Job;
  }
  