import { helloCommand } from './hello'
import { issueApiKeyCommand } from './issueApiKey'
import { requestAccessCommand } from './requestAccess'
import { setStatusCommand } from './setStatus'

export const discordCommands: DiscordCommand[] = [
    helloCommand,
    issueApiKeyCommand,
    requestAccessCommand,
    setStatusCommand,
]
