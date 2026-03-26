import { definePlugin } from 'nitro'

export default definePlugin(async () => {
    await initDb()
})
