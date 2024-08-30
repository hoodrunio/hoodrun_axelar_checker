import { checkBroadcasterBalance } from './validators/BroadcasterBalanceChecker';
import { scheduleJob } from 'node-schedule';

// Job'u her saat başı çalışacak şekilde zamanla
scheduleJob('0 * * * *', checkBroadcasterBalance);
