/** Supported mail retrieval protocols. Extend this union when adding new protocol support. */
export type EmailProtocol = 'imap'

export interface EmailAccount {
    id: string
    protocol: EmailProtocol
    name: string
    email: string
    /** Protocol-specific connection credentials (e.g. `ImapCredentials`). */
    credentials: Record<string, unknown>
    enabled: boolean
    lastCheckedAt: Date | null
    createdAt: Date
}

export interface AddEmailAccountInput {
    /** Defaults to `'imap'`. */
    protocol?: EmailProtocol
    name: string
    email: string
    credentials: Record<string, unknown>
}

/** IMAP-specific credentials shape for use with `EmailAccount.credentials`. */
export interface ImapCredentials {
    host: string
    port: number
    user: string
    password: string
}

export interface ParsedEmail {
    from?: { text?: string }
    subject?: string
    date?: Date
    text?: string
    attachments?: Array<{ filename?: string; size: number }>
}

export interface EmailWatcher {
    start(): Promise<void>
    stop(): void
    checkNow?(): Promise<{ total: number; checked: number }>
}

export interface EmailWatcherDeps {
    getEnabledAccounts(): Promise<EmailAccount[]>
    getCheckInterval(): Promise<number>
    updateLastChecked(id: string): Promise<void>
}

export interface EmailWatcherOptions {
    deps: EmailWatcherDeps
    onEmail(account: EmailAccount, email: ParsedEmail): Promise<void>
}
