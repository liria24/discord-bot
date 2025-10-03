import { apiKeyCommand } from './apiKey'
import { helpCommand } from './help'
import { preferenceCommand } from './preference'
import { statusCommand } from './status'

export const discordCommands: DiscordCommand[] = [
    helpCommand,
    statusCommand,
    apiKeyCommand,
    preferenceCommand,
]
