export interface BotStatusInput {
    message: string
    activityType: number
    setBy?: string
}

export const saveBotStatus = async (input: BotStatusInput) => {
    const [status] = await db
        .insert(schema.botStatuses)
        .values({
            message: input.message,
            activityType: input.activityType,
            setBy: input.setBy,
        })
        .returning()

    return status
}

export const getLatestBotStatus = async () =>
    await db.query.botStatuses.findFirst({
        orderBy: { createdAt: 'desc' },
        with: {
            setByUser: true,
        },
    })

export const getBotStatusHistory = async (limit = 10) =>
    await db.query.botStatuses.findMany({
        orderBy: { createdAt: 'desc' },
        limit,
        with: {
            setByUser: true,
        },
    })
