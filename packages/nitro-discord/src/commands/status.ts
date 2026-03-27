import { consola } from 'consola'
import {
    ActivityType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

import { getBotStatusStorage } from '../botStatus.js'
import type { CommandGuard, DiscordCommand } from '../types.js'

const log = consola.withTag('status')

const activityTypeChoices = [
    { name: 'Playing', value: ActivityType.Playing },
    { name: 'Streaming', value: ActivityType.Streaming },
    { name: 'Listening', value: ActivityType.Listening },
    { name: 'Watching', value: ActivityType.Watching },
    { name: 'Competing', value: ActivityType.Competing },
]

const activityTypeNames: Record<number, string> = Object.fromEntries(
    activityTypeChoices.map((c) => [c.value, c.name])
)

export const createStatusCommand = (guard?: CommandGuard, hasStorage = true): DiscordCommand => {
    const builder = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Manage bot status (admin only)')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('set')
                .setDescription('Change the bot status message')
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('Status message')
                        .setRequired(true)
                        .setMaxLength(128)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('type')
                        .setDescription('Activity type')
                        .setRequired(false)
                        .addChoices(...activityTypeChoices)
                )
        )

    if (hasStorage) {
        builder.addSubcommand((subcommand) =>
            subcommand
                .setName('history')
                .setDescription('Show bot status change history')
                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription('Number of history entries to display')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25)
                )
        )
    }

    return {
        data: builder as SlashCommandBuilder,

        async execute(interaction: ChatInputCommandInteraction) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral })

            const lacksPermission = (await guard?.(interaction)) ?? false
            if (lacksPermission) return

            const subcommand = interaction.options.getSubcommand()

            if (subcommand === 'set') {
                await handleSetStatus(interaction)
            } else if (subcommand === 'history') {
                await handleStatusHistory(interaction)
            }
        },

        showInHelp: guard ? async (interaction) => !(await guard(interaction)) : undefined,
    }
}

async function handleSetStatus(interaction: ChatInputCommandInteraction) {
    const storage = getBotStatusStorage()
    const message = interaction.options.getString('message', true)
    const activityType = interaction.options.getInteger('type') ?? ActivityType.Playing

    try {
        interaction.client.user?.setActivity(message, { type: activityType })

        await storage?.save({ message, activityType, setBy: interaction.user.id })

        const activityTypeName = activityTypeNames[activityType] ?? 'Playing'
        await interaction.editReply(`✅ Bot status updated:\n**${activityTypeName}**: ${message}`)
    } catch (error) {
        log.error('Failed to set status', error)
        await interaction.editReply('Failed to update status. Please try again.')
    }
}

async function handleStatusHistory(interaction: ChatInputCommandInteraction) {
    const storage = getBotStatusStorage()
    const limit = interaction.options.getInteger('limit') ?? 10

    try {
        const history = await storage?.getHistory(limit)

        if (!history || history.length === 0) {
            await interaction.editReply('No status change history found.')
            return
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 Bot Status Change History')
            .setColor(0x5865f2)
            .setDescription(`Showing the latest ${history.length} status change(s).`)
            .setTimestamp()

        for (const status of history) {
            const typeName = activityTypeNames[status.activityType] ?? 'Unknown'
            const setBy = status.setBy ? `<@${status.setBy}>` : 'API'
            const date = new Date(status.createdAt).toLocaleString('ja-JP', {
                timeZone: 'UTC',
            })

            embed.addFields({
                name: `${typeName}: ${status.message}`,
                value: `Set by: ${setBy}\nDate: ${date}`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        log.error('Failed to get status history', error)
        await interaction.editReply('Failed to retrieve status history. Please try again.')
    }
}
