import AppQueueFactory from "@/queue/queue/AppQueueFactory";

export const initSignatureTrackingQueue = async () => {
    const queue = AppQueueFactory.createQueue('signatureTracking');
    
    queue.process(async (job) => {
      // Signature durumlarını takip et
    });
  }