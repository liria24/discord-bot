export type { DiscordCommand, CommandGuard } from './types.js'
export type {
    EmailProtocol,
    EmailAccount,
    AddEmailAccountInput,
    ParsedEmail,
    ImapCredentials,
    EmailWatcher,
} from '@liria/email-poller'
export { createHelpCommand } from './commands/help.js'
export {
    type DiscordBotController,
    DiscordBotUnavailableError,
    getDiscordBotController,
    setDiscordBotController,
    clearDiscordBotController,
    requireReadyDiscordClient,
} from './client.js'
export type {
    DiscordPluginHooks,
    EmailMonitorConfig,
    BotStatusConfig,
    DiscordPluginConfig,
} from './plugin.js'
export { defineDiscordPlugin } from './plugin.js'
export { getBotStatusStorage, type BotStatusEntry } from './botStatus.js'
export {
    getEmailMonitor,
    getEmailMonitorStorage,
    setEmailMonitorStorage,
    clearEmailMonitorStorage,
    EmailMonitorStorage,
} from './emailMonitor.js'
