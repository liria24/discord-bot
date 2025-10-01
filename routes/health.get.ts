import { getDb } from '~/utils/db'

export default defineEventHandler(async () => {
    try {
        // データベース接続のヘルスチェック
        const db = await getDb()
        await db.execute('SELECT 1')

        return {
            status: 'ok',
            database: 'connected',
        }
    } catch (error) {
        console.error('Health check failed:', error)
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Database connection failed',
        })
    }
})
