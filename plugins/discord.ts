const logger = createConsola({ defaults: { tag: 'discord' } })
const CONTROLLER_SYMBOL = Symbol.for('discord-bot:controller')

type GlobalWithDiscordBot = typeof globalThis & {
    [CONTROLLER_SYMBOL]?: DiscordBotController
}

export default defineNitroPlugin(async (nitroApp) => {
    const globalRef = globalThis as GlobalWithDiscordBot

    if (globalRef[CONTROLLER_SYMBOL]?.isReady()) {
        logger.info(
            'Discord bot is already running. Reusing existing instance.'
        )
        return
    }

    const { discordToken, discordClientId, discordGuildId } = useRuntimeConfig()

    if (!discordToken) {
        logger.warn(
            'DISCORD_TOKEN is not set. Discord bot will not be started.'
        )
        return
    }

    if (!discordClientId) {
        logger.warn(
            'DISCORD_CLIENT_ID is not set. Discord bot will not be started.'
        )
        return
    }

    try {
        const controller = await startDiscordBot({
            token: discordToken,
            clientId: discordClientId,
            guildId: discordGuildId,
            commands: discordCommands,
        })

        globalRef[CONTROLLER_SYMBOL] = controller

        nitroApp.hooks.hook('close', async () => {
            await controller.shutdown()
            delete globalRef[CONTROLLER_SYMBOL]
        })
    } catch (error) {
        logger.error({ error }, 'Failed to start Discord bot')
    }
})
