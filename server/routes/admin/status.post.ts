import { ActivityType } from 'discord.js'
import { z } from 'zod'

const activityTypeMap = {
    Playing: ActivityType.Playing,
    Streaming: ActivityType.Streaming,
    Listening: ActivityType.Listening,
    Watching: ActivityType.Watching,
    Custom: ActivityType.Custom,
    Competing: ActivityType.Competing,
} as const

const body = z.object({
    message: z.string().min(1),
    activityType: z
        .enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Custom', 'Competing'])
        .default('Playing'),
})

export default adminHandler(async () => {
    const { message, activityType: activityTypeStr } = await validateBody(body)
    const activityType = activityTypeMap[activityTypeStr]

    const status = await saveBotStatus({
        message,
        activityType,
    })

    const client = requireReadyDiscordClient()
    try {
        client.user?.setActivity(message, { type: activityType })
    } catch (error) {
        console.error('Failed to update live bot status:', error)
    }

    return status
})
