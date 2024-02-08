import Queue from "bull";
import AppQueueFactory from "queue/queue/AppQueueFactory";

class JobProducer {
  addJob(
    queueName: string,
    data: any,
    options: Queue.JobOptions = {
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: true,
    }
  ): Promise<Queue.Job> {
    const queue = AppQueueFactory.createQueue(queueName);
    return queue.add(data, options);
  }
}

const appJobProducer = new JobProducer();

export default appJobProducer;
