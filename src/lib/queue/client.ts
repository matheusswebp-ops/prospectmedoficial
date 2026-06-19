import { Queue } from 'bullmq'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const connectionOpts = {
  host: (() => {
    try { return new URL(redisUrl).hostname } catch { return 'localhost' }
  })(),
  port: (() => {
    try { return parseInt(new URL(redisUrl).port || '6379') } catch { return 6379 }
  })(),
  password: (() => {
    try { return new URL(redisUrl).password || undefined } catch { return undefined }
  })(),
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
}

export const prospeccaoQueue = new Queue('prospeccao', { connection: connectionOpts })
export const pagespeedQueue = new Queue('pagespeed', { connection: connectionOpts })
export const deployLpQueue = new Queue('deploy-lp', { connection: connectionOpts })
