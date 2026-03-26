import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import { createClient } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle } from 'drizzle-orm/libsql'
import { useRuntimeConfig } from 'nitro/runtime-config'

import { relations } from '../../db/relations'
import * as schema from '../../db/schema'

const log = logger('db')

const config = useRuntimeConfig()

type Schema = typeof schema
type Relations = typeof relations
type Client = ReturnType<typeof createClient>

export let db!: LibSQLDatabase<Schema, Relations>
let sqliteClient: Client | null = null

export const initDb = async () => {
    const dbPath = config.sqlite.dbPath

    if (dbPath === ':memory:') {
        log.info('Using in-memory SQLite database')
        sqliteClient = createClient({ url: ':memory:' })
    } else {
        log.info(`Initializing SQLite database at ${dbPath}`)

        // Create directory if it doesn't exist
        const dir = dirname(dbPath)
        await mkdir(dir, { recursive: true })

        // libsql requires file: prefix for local files
        const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`
        sqliteClient = createClient({ url })
    }

    db = drizzle({ client: sqliteClient, schema, relations })

    log.success('SQLite database initialized')
}

export const getSQLiteClient = () => sqliteClient

export { schema, relations }
