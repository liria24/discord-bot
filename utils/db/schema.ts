import { relations } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const permissionEnum = pgEnum('permission_level', ['granted', 'admin'])
export const permissionRequestStatusEnum = pgEnum('permission_request_status', [
    'pending',
    'approved',
    'rejected',
])

export const users = pgTable('users', {
    id: text('id').primaryKey(), // Discord user ID
    username: text('username'),
    permissionLevel: permissionEnum('permission_level'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
})

export const apiKeys = pgTable('api_keys', {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    lastFour: text('last_four').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),
})

export const permissionRequests = pgTable('permission_requests', {
    id: uuid('id').primaryKey(),
    requesterId: text('requester_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    status: permissionRequestStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    adminMessageId: text('admin_message_id'),
})

export const usersRelations = relations(users, ({ many }) => ({
    apiKeys: many(apiKeys),
    requests: many(permissionRequests),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    user: one(users, {
        fields: [apiKeys.userId],
        references: [users.id],
    }),
}))

export const permissionRequestsRelations = relations(
    permissionRequests,
    ({ one }) => ({
        requester: one(users, {
            fields: [permissionRequests.requesterId],
            references: [users.id],
        }),
        resolver: one(users, {
            fields: [permissionRequests.resolvedBy],
            references: [users.id],
        }),
    })
)

export type PermissionLevel = (typeof permissionEnum.enumValues)[number]
export type PermissionRequestStatus =
    (typeof permissionRequestStatusEnum.enumValues)[number]
