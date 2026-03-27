import { consola } from 'consola'
import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js'

import { getEmailMonitor, getEmailMonitorStorage } from '../emailMonitor.js'
import type { CommandGuard, DiscordCommand } from '../types.js'

const log = consola.withTag('email')

/**
 * Creates the `/email` slash command for managing monitored email accounts.
 *
 * Currently supports IMAP via the `add` subcommand. For future multi-protocol
 * support, consider splitting into `add-imap`, `add-pop3`, etc. subcommands.
 */
export const createEmailCommand = (guard?: CommandGuard): DiscordCommand => ({
    data: new SlashCommandBuilder()
        .setName('email')
        .setDescription('Manage email monitoring accounts (admin only)')
        .addSubcommand((subcommand) =>
            subcommand.setName('list').setDescription('Show the list of registered email accounts')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription('Add a new email account')
                .addStringOption((option) =>
                    option
                        .setName('name')
                        .setDescription('Account name (e.g. Work Email)')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption((option) =>
                    option.setName('email').setDescription('Email address').setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('host')
                        .setDescription(
                            'Mail server host (e.g. imap.example.com or imap.example.com:993)'
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('password').setDescription('IMAP password').setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('user')
                        .setDescription('IMAP username (defaults to email address if omitted)')
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle the email account on/off')
                .addStringOption((option) =>
                    option.setName('email').setDescription('Email address').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('delete')
                .setDescription('Delete an email account')
                .addStringOption((option) =>
                    option.setName('email').setDescription('Email address').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('check').setDescription('Immediately check for new emails')
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand()

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const lacksPermission = (await guard?.(interaction)) ?? false
        if (lacksPermission) return

        if (subcommand === 'list') await handleListEmails(interaction)
        else if (subcommand === 'add') await handleAddEmail(interaction)
        else if (subcommand === 'toggle') await handleToggleEmail(interaction)
        else if (subcommand === 'delete') await handleDeleteEmail(interaction)
        else if (subcommand === 'check') await handleCheckNow(interaction)
    },
    showInHelp: guard ? async (interaction) => !(await guard(interaction)) : undefined,
})

const handleListEmails = async (interaction: ChatInputCommandInteraction) => {
    const storage = getEmailMonitorStorage()
    try {
        const accounts = await storage?.listAccounts()

        if (!accounts || accounts.length === 0) {
            await interaction.editReply('No email accounts have been registered.')
            return
        }

        const interval = await storage?.getCheckInterval()

        const embed = new EmbedBuilder()
            .setTitle('📧 Email Account List')
            .setColor(0x3498db)
            .setDescription(
                `Check interval: **every ${interval} minutes**\nTotal: ${accounts.length} account(s)`
            )
            .setTimestamp()

        for (const account of accounts) {
            const lastChecked = account.lastCheckedAt
                ? account.lastCheckedAt.toLocaleString('en-US')
                : 'Never checked'

            embed.addFields({
                name: account.enabled ? `${account.name}` : `${account.name} ❌ Disabled`,
                value: `Email: ${account.email}\n` + `Last checked: ${lastChecked}`,
                inline: false,
            })
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        log.error('Failed to list email accounts', error)
        await interaction.editReply('Failed to retrieve email account list.')
    }
}

const handleAddEmail = async (interaction: ChatInputCommandInteraction) => {
    const storage = getEmailMonitorStorage()
    const name = interaction.options.getString('name', true)
    const email = interaction.options.getString('email', true)
    const hostInput = interaction.options.getString('host', true)
    const password = interaction.options.getString('password', true)
    const userInput = interaction.options.getString('user')

    // Parse host and port (supports host:port format)
    let host = hostInput
    let port = 993

    if (hostInput.includes(':')) {
        const [h, p] = hostInput.split(':')
        host = h ?? hostInput
        if (p !== undefined) {
            const parsedPort = Number.parseInt(p, 10)
            if (!Number.isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535)
                port = parsedPort
        }
    }

    // Use email address if username is not provided
    const user = userInput?.trim() || email

    try {
        const account = await storage?.addAccount({
            protocol: 'imap',
            name,
            email,
            credentials: { host, port, user, password },
        })

        if (!account) throw new Error('Failed to create email account')

        await interaction.editReply(
            `✅ Email account "${account.name}" (${account.email}) has been added.`
        )
    } catch (error) {
        log.error('Failed to create email account', error)
        await interaction.editReply('Failed to add email account. Please check the input.')
    }
}

const handleToggleEmail = async (interaction: ChatInputCommandInteraction) => {
    const storage = getEmailMonitorStorage()
    const email = interaction.options.getString('email', true)

    try {
        const account = await storage?.getAccountByEmail(email)

        if (!account) {
            await interaction.editReply('No account found for the specified email address.')
            return
        }

        const newStatus = !account.enabled
        await storage?.toggleAccount(account.id, newStatus)

        await interaction.editReply(
            `✅ Email account "${account.name}" has been ${newStatus ? 'enabled' : 'disabled'}.`
        )
    } catch (error) {
        log.error('Failed to toggle email account', error)
        await interaction.editReply('Failed to toggle email account.')
    }
}

const handleDeleteEmail = async (interaction: ChatInputCommandInteraction) => {
    const storage = getEmailMonitorStorage()
    const email = interaction.options.getString('email', true)

    try {
        const account = await storage?.getAccountByEmail(email)

        if (!account) {
            await interaction.editReply('No account found for the specified email address.')
            return
        }

        await storage?.removeAccount(account.id)

        await interaction.editReply(`✅ Email account "${account.name}" has been deleted.`)
    } catch (error) {
        log.error('Failed to delete email account', error)
        await interaction.editReply('Failed to delete email account.')
    }
}

const handleCheckNow = async (interaction: ChatInputCommandInteraction) => {
    const monitor = getEmailMonitor()
    await interaction.editReply('📧 Starting email check...')

    try {
        const result = await monitor?.checkNow?.()

        if (!result) {
            await interaction.editReply('❌ Email monitoring is not enabled.')
            return
        }

        if (result.total === 0) {
            await interaction.editReply('❌ No active email accounts found.')
            return
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Email Check Complete')
            .setColor(0x2ecc71)
            .addFields(
                {
                    name: 'Target Accounts',
                    value: `${result.total}`,
                    inline: true,
                },
                {
                    name: 'Checked Successfully',
                    value: `${result.checked}`,
                    inline: true,
                }
            )
            .setTimestamp()

        if (result.checked < result.total)
            embed.setDescription(
                `⚠️ Errors occurred in ${result.total - result.checked} account(s).`
            )

        await interaction.editReply({ content: '', embeds: [embed] })
    } catch (error) {
        log.error('Failed to check emails now', error)
        await interaction.editReply('❌ An error occurred during email check.')
    }
}
