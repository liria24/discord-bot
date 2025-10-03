import type { APIEmbed, MessageCreateOptions } from 'discord.js'

const embedFieldSchema = z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional(),
})

const embedImageSchema = z
    .object({
        url: z.url(),
    })
    .optional()

const embedAuthorSchema = z
    .object({
        name: z.string(),
        url: z.url().optional(),
        icon_url: z.url().optional(),
    })
    .optional()

const embedFooterSchema = z
    .object({
        text: z.string(),
        icon_url: z.url().optional(),
    })
    .optional()

const embedSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    color: z.number().int().min(0).max(0xffffff).optional(),
    url: z.url().optional(),
    timestamp: z.iso.datetime().optional(),
    thumbnail: embedImageSchema,
    image: embedImageSchema,
    author: embedAuthorSchema,
    fields: z.array(embedFieldSchema).max(25).optional(),
    footer: embedFooterSchema,
})

const adminMessageBodySchema = z
    .object({
        content: z.string().optional(),
        embeds: z.array(embedSchema).max(10).optional(),
    })
    .refine(
        (data) => {
            const hasContent = typeof data.content === 'string' && data.content.trim().length > 0
            const hasEmbeds = Array.isArray(data.embeds) && data.embeds.length > 0
            return hasContent || hasEmbeds
        },
        {
            message: 'Either content or embeds must be provided',
        }
    )

export default defineEventHandler(async (event) => {
    const headers = getRequestHeaders(event)
    const authHeader = headers.authorization?.trim()

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('Missing or invalid Authorization header')
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid API key',
        })
    }

    const rawApiKey = authHeader.slice('Bearer '.length).trim()
    const apiKeyRecord = await verifyApiKey(rawApiKey)

    if (!apiKeyRecord) {
        console.warn('Unauthorized request with unknown API key prefix')
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
            message: 'Invalid API key',
        })
    }

    const permissionLevel = apiKeyRecord.user?.permissionLevel

    if (permissionLevel !== 'granted' && permissionLevel !== 'admin') {
        console.warn('Authenticated user lacks permission to post messages', {
            userId: apiKeyRecord.userId,
        })
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden',
            message: 'Permission denied',
        })
    }

    const { content, embeds } = await validateBody(adminMessageBodySchema, {
        sanitize: true,
    })
    const trimmedContent = content?.trim()

    const controller = getDiscordBotController()

    if (!controller) {
        console.error('Discord bot controller is not available')
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not running',
        })
    }

    if (!controller.isReady()) {
        console.warn('Discord bot client is not ready to send messages')
        throw createError({
            statusCode: 503,
            statusMessage: 'Service Unavailable',
            message: 'Discord bot is not ready yet',
        })
    }

    const client = controller.client

    try {
        // admin権限を持つユーザーを取得し、DM受信をオプトアウトしていないユーザーのみフィルタリング
        const allAdminUsers = await listUsersByPermission('admin')
        const adminUsers = allAdminUsers.filter((user) => !user.adminDmOptOut)

        if (!adminUsers || adminUsers.length === 0) {
            console.warn('No admin users found to send DM (or all opted out)')
            return {
                status: 'skipped',
                reason: 'No admin users available (all may have opted out)',
            }
        }

        const messageOptions: MessageCreateOptions = {}
        if (trimmedContent) messageOptions.content = trimmedContent
        if (embeds) messageOptions.embeds = embeds as APIEmbed[]

        const results = {
            sent: 0,
            failed: 0,
            errors: [] as string[],
        }

        // 各adminユーザーにDMを送信
        for (const admin of adminUsers) {
            try {
                const user = await client.users.fetch(admin.id)
                await user.send(messageOptions)
                results.sent++
            } catch (error) {
                console.error(`Failed to send DM to admin user ${admin.id}:`, error)
                results.failed++
                results.errors.push(`User ${admin.username || admin.id}: ${error}`)
            }
        }

        await markApiKeyUsed(apiKeyRecord.id)

        if (results.sent === 0) {
            throw createError({
                statusCode: 502,
                statusMessage: 'Bad Gateway',
                message: 'Failed to deliver message to any admin users',
                data: results,
            })
        }

        return {
            status: 'ok',
            sent: results.sent,
            failed: results.failed,
            ...(results.failed > 0 && { errors: results.errors }),
        }
    } catch (error) {
        console.error('Failed to deliver admin message to Discord', error)
        throw createError({
            statusCode: 502,
            statusMessage: 'Bad Gateway',
            message: 'Failed to deliver message to Discord',
            cause: error,
        })
    }
})
