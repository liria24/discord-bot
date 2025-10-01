import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const logger = createConsola({ defaults: { tag: 'db' } })

type Schema = typeof schema

const DB_SYMBOL = Symbol.for('discord-bot:db')
const DB_INIT_SYMBOL = Symbol.for('discord-bot:db-init')

type GlobalWithDb = typeof globalThis & {
    [DB_SYMBOL]?: {
        pool: Pool
        db: NodePgDatabase<Schema>
    }
    [DB_INIT_SYMBOL]?: Promise<{
        pool: Pool
        db: NodePgDatabase<Schema>
    }>
}

const getConnectionString = (): string => {
    const url = process.env.DATABASE_URL
    if (!url) {
        throw new Error('DATABASE_URL is not configured')
    }
    return url
}

const createDbClient = async () => {
    const pool = new Pool({
        connectionString: getConnectionString(),
        // Railway Postgres Serverless 向けの設定
        connectionTimeoutMillis: 30000, // 30秒
        idleTimeoutMillis: 30000,
        max: 10, // 最大接続数
        // コールドスタート時の接続待機時間を確保
        query_timeout: 30000,
    })

    // コールドスタート時の初回接続をリトライ
    logger.info('Attempting to connect to database...')
    await retryWithBackoff(
        async () => {
            const client = await pool.connect()
            await client.query('SELECT 1')
            client.release()
            logger.success('Database connection established successfully')
        },
        {
            maxRetries: 5,
            minTimeout: 1000,
            maxTimeout: 30000,
            factor: 2,
        }
    )

    const db = drizzle(pool, { schema })
    return { pool, db }
}

const initializeDb = async (): Promise<void> => {
    const globalRef = globalThis as GlobalWithDb

    if (globalRef[DB_SYMBOL]) {
        return
    }

    if (!globalRef[DB_INIT_SYMBOL]) {
        globalRef[DB_INIT_SYMBOL] = createDbClient()
    }

    try {
        const client = await globalRef[DB_INIT_SYMBOL]
        globalRef[DB_SYMBOL] = client
        globalRef[DB_INIT_SYMBOL] = undefined
    } catch (error) {
        globalRef[DB_INIT_SYMBOL] = undefined
        throw error
    }
}

export const getDb = async (): Promise<NodePgDatabase<Schema>> => {
    await initializeDb()
    const globalRef = globalThis as GlobalWithDb
    return globalRef[DB_SYMBOL]!.db
}

export const getDbPool = async (): Promise<Pool> => {
    await initializeDb()
    const globalRef = globalThis as GlobalWithDb
    return globalRef[DB_SYMBOL]!.pool
}

export { schema }
