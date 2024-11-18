import AppQueueFactory from "@/queue/queue/AppQueueFactory";

export const initPollTrackingQueue = async () => {
    const queue = AppQueueFactory.createQueue('pollTracking');
    
    queue.process(async (job) => {
      // Poll durumlarını takip et
    });
  }