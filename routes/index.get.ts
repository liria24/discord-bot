const { discord } = useRuntimeConfig()

export default defineEventHandler(async () => {
    return sendRedirect(useEvent(), discord.installLink)
})
