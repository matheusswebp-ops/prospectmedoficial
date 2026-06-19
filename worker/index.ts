import http from 'http'
import { Worker } from 'bullmq'
import { processJob as processProspectar } from './prospectar.worker'
import { processJob as processPagespeed } from './pagespeed.worker'
import { processJob as processDeployLp } from './deploy-lp.worker'

// ──────────────────────────────────────────────
// Validação de variáveis de ambiente obrigatórias
// ──────────────────────────────────────────────
const requiredEnvVars = [
  'REDIS_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_PAGESPEED_API_KEY',
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[worker] Variável de ambiente obrigatória não definida: ${envVar}`)
    process.exit(1)
  }
}

// ──────────────────────────────────────────────
// ConnectionOptions para BullMQ (usa seu próprio ioredis bundled)
// Passar a URL diretamente evita conflito de tipos entre versões do ioredis
// ──────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL!

// Parsear a URL para extrair host/port/password compatível com BullMQ ConnectionOptions
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: url.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
    }
  } catch {
    throw new Error(`REDIS_URL inválida: ${url}`)
  }
}

const connectionOptions = parseRedisUrl(REDIS_URL)

// ──────────────────────────────────────────────
// Worker: prospeccao (concurrency: 2)
// ──────────────────────────────────────────────
const prospeccaoWorker = new Worker(
  'prospeccao',
  async (job) => {
    console.log(`[prospeccao] Iniciando job ${job.id} — batchId=${job.data.batchId}`)
    await processProspectar(job)
  },
  {
    connection: connectionOptions,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  }
)

prospeccaoWorker.on('completed', (job) => {
  console.log(`[prospeccao] Job ${job.id} concluído com sucesso`)
})

prospeccaoWorker.on('failed', (job, err) => {
  console.error(`[prospeccao] Job ${job?.id} falhou:`, err.message)
})

// ──────────────────────────────────────────────
// Worker: pagespeed (concurrency: 1, limiter: 1 req/3s)
// ──────────────────────────────────────────────
const pagespeedWorker = new Worker(
  'pagespeed',
  async (job) => {
    console.log(`[pagespeed] Iniciando job ${job.id} — leadId=${job.data.leadId}`)
    await processPagespeed(job)
  },
  {
    connection: connectionOptions,
    concurrency: 1,
    limiter: { max: 1, duration: 3_000 },
  }
)

pagespeedWorker.on('completed', (job) => {
  console.log(`[pagespeed] Job ${job.id} concluído com sucesso`)
})

pagespeedWorker.on('failed', (job, err) => {
  console.error(`[pagespeed] Job ${job?.id} falhou:`, err.message)
})

// ──────────────────────────────────────────────
// Worker: deploy-lp (concurrency: 2, rate limit: 10/hora)
// Respeita o limite de 100 deploys/dia da Vercel Hobby
// ──────────────────────────────────────────────
const deployLpWorker = new Worker(
  'deploy-lp',
  async (job) => {
    console.log(`[deploy-lp] Iniciando job ${job.id} — leadId=${job.data.leadId}`)
    await processDeployLp(job)
  },
  {
    connection: connectionOptions,
    concurrency: 2,
    limiter: { max: 10, duration: 3_600_000 }, // máx 10 deploys/hora
  }
)

deployLpWorker.on('completed', (job) => {
  console.log(`[deploy-lp] Job ${job.id} concluído com sucesso`)
})

deployLpWorker.on('failed', (job, err) => {
  console.error(`[deploy-lp] Job ${job?.id} falhou:`, err.message)
})

// ──────────────────────────────────────────────
// Health check HTTP na porta 3001
// ──────────────────────────────────────────────
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT ?? '3001', 10)

const healthServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }
  res.writeHead(404)
  res.end()
})

healthServer.listen(HEALTH_PORT, () => {
  console.log(`[health] Health check disponível em http://0.0.0.0:${HEALTH_PORT}/health`)
})

// ──────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Recebido ${signal} — encerrando gracefully...`)

  try {
    await Promise.all([
      prospeccaoWorker.close(),
      pagespeedWorker.close(),
      deployLpWorker.close(),
    ])
    console.log('[worker] Workers encerrados')

    healthServer.close(() => {
      console.log('[health] Servidor HTTP encerrado')
      process.exit(0)
    })
  } catch (err) {
    console.error('[worker] Erro durante shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

console.log('[worker] ProspectMed workers iniciados — aguardando jobs...')
