import { eq } from 'drizzle-orm'

export interface CreateEmailAccountInput {
    name: string
    email: string
    imapHost: string
    imapPort?: number
    imapUser: string
    imapPassword: string
}

export const createEmailAccount = async (input: CreateEmailAccountInput) => {
    const [account] = await db
        .insert(schema.emailAccounts)
        .values({
            name: input.name,
            email: input.email,
            imapHost: input.imapHost,
            imapPort: input.imapPort ?? 993,
            imapUser: input.imapUser,
            imapPassword: input.imapPassword,
            enabled: true,
        })
        .returning()

    return account
}

export const listEmailAccounts = async () => {
    return db.query.emailAccounts.findMany({
        orderBy: { createdAt: 'desc' },
    })
}

export const getEmailAccountById = async (id: string) =>
    db.query.emailAccounts.findFirst({
        where: { id },
    })

export const getEmailAccountByAddress = async (email: string) =>
    db.query.emailAccounts.findFirst({
        where: { email },
    })

export const updateEmailAccountEnabled = async (id: string, enabled: boolean) => {
    const [updated] = await db
        .update(schema.emailAccounts)
        .set({ enabled })
        .where(eq(schema.emailAccounts.id, id))
        .returning()

    return updated
}

export const updateEmailAccountLastChecked = async (id: string) => {
    await db
        .update(schema.emailAccounts)
        .set({ lastCheckedAt: new Date() })
        .where(eq(schema.emailAccounts.id, id))
}

export const deleteEmailAccount = async (id: string) => {
    await db.delete(schema.emailAccounts).where(eq(schema.emailAccounts.id, id))
}

export const getCheckInterval = async (): Promise<number> => {
    const settings = await db.query.emailCheckSettings.findFirst({
        where: { id: 'singleton' },
    })
    return settings?.checkIntervalMinutes ?? 30
}

export const setCheckInterval = async (minutes: number) => {
    await db
        .insert(schema.emailCheckSettings)
        .values({
            id: 'singleton',
            checkIntervalMinutes: minutes,
        })
        .onConflictDoUpdate({
            target: schema.emailCheckSettings.id,
            set: {
                checkIntervalMinutes: minutes,
            },
        })
}

export const listEnabledEmailAccounts = async () =>
    db.query.emailAccounts.findMany({
        where: { enabled: true },
        orderBy: { lastCheckedAt: 'asc' },
    })
