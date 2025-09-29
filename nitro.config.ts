export default defineNitroConfig({
    compatibilityDate: '2025-09-29',

    preset: 'node-server',

    plugins: [],

    // 開発モードの設定
    dev: process.env.NODE_ENV !== 'production',

    // TypeScript設定
    typescript: {
        generateTsConfig: true,
    },

    runtimeConfig: {
        discordToken: process.env.DISCORD_TOKEN,
        discordClientId: process.env.DISCORD_CLIENT_ID,
        discordGuildId: process.env.DISCORD_GUILD_ID,
        public: {
            appName: 'Discord Bot',
        },
    },

    // ソースディレクトリ
    srcDir: '.',

    // 出力設定
    output: {
        dir: '.output',
        publicDir: '.output/public',
        serverDir: '.output/server',
    },

    imports: {
        imports: [
            {
                name: 'createConsola',
                from: 'consola',
            },
        ],
    },
})
