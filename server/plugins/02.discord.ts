import {
    type ActivityType,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    type Interaction,
    REST,
    Routes,
} from 'discord.js'
import { definePlugin } from 'nitro'
import { useRuntimeConfig } from 'nitro/runtime-config'

import { discordCommands } from '../discord/commands'

const log = logger('discord')

async function handleInteraction(
    interaction: Interaction,
    commandMap: Collection<string, DiscordCommand>
) {
    if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName)
        if (!command) {
            log.warn(`Received interaction for unknown command: ${interaction.commandName}`)
            await interaction.reply({
                content: 'This command is not available anymore.',
                ephemeral: true,
            })
            return
        }
        try {
            log.info(
                {
                    command: interaction.commandName,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId,
                },
                'Slash command invoked'
            )
            await command.execute(interaction)
        } catch (error) {
            log.error({ error }, `Error while executing command ${interaction.commandName}`)
            const reply = { content: 'コマンド実行中にエラーが発生しました。', ephemeral: true }
            await (interaction.replied || interaction.deferred
                ? interaction.followUp(reply)
                : interaction.reply(reply))
        }
        return
    }

    if (interaction.isButton()) {
        if (await handlePermissionRequestButton(interaction)) return
        await handlePermissionPromptButton(interaction)
    }
}

async function registerCommands(token: string, clientId: string, guildId: string) {
    const rest = new REST({ version: '10' }).setToken(token)
    const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId)
    log.log(
        `Registering ${discordCommands.length} slash command(s) on ${guildId ? `guild ${guildId}` : 'global scope'}`
    )
    await rest.put(route, { body: discordCommands.map((c) => c.data.toJSON()) })
    log.success('Slash commands registered successfully')
}

export default definePlugin(async (nitroApp) => {
    const { discord, email } = useRuntimeConfig()

    if (!discord.token || !discord.clientId) {
        log.warn(
            'Discord bot configuration is incomplete (missing token or client ID). Discord bot will not be started.'
        )
        return
    }

    if (getDiscordBotController()?.isReady()) {
        log.info('Discord bot is already running. Reusing existing instance.')
        return
    }

    try {
        const client = new Client({ intents: [GatewayIntentBits.Guilds] })
        const commandMap = new Collection(
            discordCommands.map((cmd) => [cmd.data.name, cmd] as [string, DiscordCommand])
        )

        client.once(Events.ClientReady, async (readyClient) => {
            log.success(`Bot logged in as ${readyClient.user.tag}`)
            try {
                const latestStatus = await getLatestBotStatus()
                if (latestStatus) {
                    readyClient.user.setActivity(latestStatus.message, {
                        type: latestStatus.activityType as ActivityType,
                    })
                    log.info(
                        { message: latestStatus.message, type: latestStatus.activityType },
                        'Restored last bot status'
                    )
                }
            } catch (error) {
                log.warn({ error }, 'Failed to restore last bot status')
            }
        })

        client.on(Events.InteractionCreate, (interaction) =>
            handleInteraction(interaction, commandMap)
        )

        await registerCommands(discord.token, discord.clientId, discord.guildId)

        log.info('Logging in to Discord API…')
        await client.login(discord.token)

        const controller: DiscordBotController = {
            client,
            isReady: () => client.isReady(),
            async shutdown() {
                log.info('Shutting down Discord bot')
                await client.destroy()
            },
        }
        setDiscordBotController(controller)

        if (email.monitor) {
            log.info('Starting email monitoring service')
            await startEmailMonitoring()
        } else {
            log.info('Email monitoring is disabled by configuration')
        }

        nitroApp.hooks.hook('close', async () => {
            if (email.monitor) {
                log.info('Stopping email monitoring service')
                stopEmailMonitoring()
            }
            await controller.shutdown()
            clearDiscordBotController()
        })
    } catch (error) {
        log.error({ error }, 'Failed to start Discord bot')
    }
})
