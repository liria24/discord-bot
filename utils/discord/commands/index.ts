import { helloCommand } from './hello'
import { issueApiKeyCommand } from './issueApiKey'
import { requestAccessCommand } from './requestAccess'

export const discordCommands: DiscordCommand[] = [
    helloCommand,
    issueApiKeyCommand,
    requestAccessCommand,
]
