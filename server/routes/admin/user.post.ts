import { z } from 'zod'

const body = z.object({
    id: z.string().optional(),
    username: z.string().min(1),
    adminDmOptOut: z.boolean().optional().default(false),
})

export default adminHandler(async () => {
    const { id, username, adminDmOptOut } = await validateBody(body)

    const result = await db
        .insert(schema.users)
        .values({
            id: id,
            username,
            adminDmOptOut,
            permissionLevel: 'admin',
        })
        .onConflictDoUpdate({
            target: schema.users.id,
            set: {
                username,
                adminDmOptOut,
                permissionLevel: 'admin',
                updatedAt: new Date(),
            },
        })
        .returning()

    return result
})
