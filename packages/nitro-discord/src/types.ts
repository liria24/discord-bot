import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export interface DiscordCommand {
    data: SlashCommandBuilder
    execute(interaction: ChatInputCommandInteraction): Promise<void>
    showInHelp?: (interaction: ChatInputCommandInteraction) => Promise<boolean> | boolean
}

/**
 * Returns `true` when the user lacks permission (access should be denied).
 */
export type CommandGuard = (interaction: ChatInputCommandInteraction) => Promise<boolean>
