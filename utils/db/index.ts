import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

type Schema = typeof schema

const DB_SYMBOL = Symbol.for('discord-bot:db')

type GlobalWithDb = typeof globalThis & {
    [DB_SYMBOL]?: {
        pool: Pool
        db: NodePgDatabase<Schema>
    }
}

const getConnectionString = (): string => {
    const url = process.env.DATABASE_URL
    if (!url) {
        throw new Error('DATABASE_URL is not configured')
    }
    return url
}

const createDbClient = () => {
    const pool = new Pool({ connectionString: getConnectionString() })
    const db = drizzle(pool, { schema })
    return { pool, db }
}

export const getDb = (): NodePgDatabase<Schema> => {
    const globalRef = globalThis as GlobalWithDb

    if (!globalRef[DB_SYMBOL]) {
        globalRef[DB_SYMBOL] = createDbClient()
    }

    return globalRef[DB_SYMBOL]!.db
}

export const getDbPool = (): Pool => {
    const globalRef = globalThis as GlobalWithDb

    if (!globalRef[DB_SYMBOL]) {
        globalRef[DB_SYMBOL] = createDbClient()
    }

    return globalRef[DB_SYMBOL]!.pool
}

export { schema }
