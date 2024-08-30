import Queue from "bull";
import AppQueueFactory from "queue/queue/AppQueueFactory";

class JobProducer {
  addJob<T>(
    queueName: string,
    data: T,
    options: Queue.JobOptions = {
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: true,
    }
  ): Promise<Queue.Job> {
    const queue = AppQueueFactory.createQueue<T>(queueName);
    queue.on("completed", async (job) => {
      // if(options.removeOnComplete) AppQueueFactory.removeQueue(queueName);
    })
    return queue.add(data, options);
  }
}

const appJobProducer = new JobProducer();

export default appJobProducer;
