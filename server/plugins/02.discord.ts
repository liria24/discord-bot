import { defineDiscordPlugin, getDiscordBotController } from '@liria/nitro-discord'

export default defineDiscordPlugin(
    {
        async onButton(interaction) {
            if (await handlePermissionRequestButton(interaction)) return
            await handlePermissionPromptButton(interaction)
        },
    },
    {
        botName: 'Liria Bot',
        help: {
            footer: 'Contact an administrator if you have any questions.',
        },
        emailMonitor: {
            enabled: true,
            onNewEmail: async ({ embed }) => {
                const controller = getDiscordBotController()

                if (!controller || !controller.isReady()) {
                    logger('emailNotify').warn('Discord bot is not ready')
                    return
                }

                const client = controller.client

                const allAdminUsers = await listUsersByPermission('admin')
                const adminUsers = allAdminUsers.filter((user) => !user.adminDmOptOut)

                if (!adminUsers || adminUsers.length === 0) {
                    logger('emailNotify').warn('No admin users available to receive email')
                    return
                }

                for (const admin of adminUsers)
                    try {
                        const user = await client.users.fetch(admin.id)
                        await user.send({ embeds: [embed] })
                        logger('emailNotify').info(
                            `Sent email notification to admin ${admin.username}`
                        )
                    } catch (error) {
                        logger('emailNotify').error(
                            `Failed to send email notification to admin ${admin.id}:`,
                            error
                        )
                    }
            },
        },
        botStatus: {
            enabled: true,
            routeAuth: (inner) => adminHandler(({ event }) => inner(event)),
        },
        guard: (interaction) => showPermissionPromptIfNeeded(interaction, 'admin'),
    }
)
