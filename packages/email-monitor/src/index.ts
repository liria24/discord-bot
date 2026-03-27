export type {
    EmailProtocol,
    EmailAccount,
    AddEmailAccountInput,
    ImapCredentials,
    ParsedEmail,
    EmailWatcher,
    EmailWatcherOptions,
    EmailWatcherDeps,
} from './types.js'

import type { Readable } from 'node:stream'

import type { ImapMessage } from 'imap'
import Imap from 'imap'
import { simpleParser } from 'mailparser'

import type { EmailAccount, EmailWatcherOptions, ImapCredentials, ParsedEmail } from './types.js'

function extractImapCredentials(credentials: Record<string, unknown>): ImapCredentials {
    const { host, port, user, password } = credentials
    if (
        typeof host !== 'string' ||
        typeof port !== 'number' ||
        typeof user !== 'string' ||
        typeof password !== 'string'
    ) {
        throw new Error(
            `Invalid IMAP credentials shape: ${JSON.stringify({ host, port, user, password })}`
        )
    }
    return { host, port, user, password }
}

const fetchNewEmails = (
    account: EmailAccount,
    onEmail: EmailWatcherOptions['onEmail']
): Promise<void> =>
    new Promise((resolve, reject) => {
        const { host, port, user, password } = extractImapCredentials(account.credentials)
        const imap = new Imap({
            user,
            password,
            host,
            port,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
        })

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err) => {
                if (err) return reject(err)

                imap.search(['UNSEEN'], (err, results) => {
                    if (err) return reject(err)

                    if (!results || results.length === 0) {
                        imap.end()
                        return
                    }

                    console.info(`Found ${results.length} new email(s) for ${account.email}`)

                    const fetch = imap.fetch(results, { bodies: '', markSeen: true })
                    const pending: Promise<void>[] = []

                    fetch.on('message', (msg: ImapMessage) => {
                        const p = new Promise<void>((res) => {
                            msg.on('body', (stream) => {
                                simpleParser(stream as unknown as Readable)
                                    .then(async (parsed) => {
                                        const email: ParsedEmail = {
                                            from: parsed.from
                                                ? { text: parsed.from.text }
                                                : undefined,
                                            subject: parsed.subject,
                                            date: parsed.date,
                                            text: parsed.text,
                                            attachments: parsed.attachments?.map((att) => ({
                                                filename: att.filename,
                                                size: att.size,
                                            })),
                                        }
                                        try {
                                            await onEmail(account, email)
                                        } catch (err) {
                                            console.error(`Failed to handle email`, err)
                                        }
                                    })
                                    .catch((err) => console.error(`Failed to parse email`, err))
                                    .finally(res)
                            })
                        })
                        pending.push(p)
                    })

                    fetch.once('error', reject)

                    fetch.once('end', () => {
                        Promise.all(pending)
                            .catch((err) => console.error('Error processing emails', err))
                            .finally(() => imap.end())
                    })
                })
            })
        })

        imap.once('error', reject)
        imap.once('end', resolve)
        imap.connect()
    })

export const createEmailWatcher = (options: EmailWatcherOptions) => {
    const { deps, onEmail } = options
    let timer: ReturnType<typeof setTimeout> | null = null

    const runChecks = async (accounts: EmailAccount[]) => {
        let checked = 0
        for (const account of accounts) {
            try {
                await fetchNewEmails(account, onEmail)
                await deps.updateLastChecked(account.id)
                checked++
            } catch (err) {
                console.error(`Failed to check ${account.email}`, err)
            }
        }
        return { total: accounts.length, checked }
    }

    const checkEmails = async () => {
        try {
            const accounts = await deps.getEnabledAccounts()
            if (accounts.length === 0) return
            console.info(`Checking ${accounts.length} account(s)`)
            await runChecks(accounts)
        } catch (err) {
            console.error('Failed to check emails', err)
        }
    }

    const scheduleNext = async () => {
        const minutes = await deps.getCheckInterval()
        timer = setTimeout(
            async () => {
                await checkEmails()
                await scheduleNext()
            },
            minutes * 60 * 1000
        )
    }

    return {
        async start() {
            console.info('Starting email watcher')
            await checkEmails()
            await scheduleNext()
        },

        stop() {
            if (timer) {
                clearTimeout(timer)
                timer = null
                console.info('Stopped email watcher')
            }
        },

        async checkNow() {
            const accounts = await deps.getEnabledAccounts()
            console.info(`Manually checking ${accounts.length} account(s)`)
            return runChecks(accounts)
        },
    }
}
