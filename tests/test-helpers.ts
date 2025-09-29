import { Client, Events, GatewayIntentBits } from 'discord.js'

/**
 * Discord botとしてログインを試行し、成功するかどうかをテストする関数
 * @param token - テストするDiscordトークン
 * @returns ログインが成功した場合はtrue、失敗した場合はfalse
 */
export const testDiscordBotLogin = async (token: string): Promise<boolean> => {
    if (!token || typeof token !== 'string') {
        return false
    }

    return new Promise((resolve) => {
        const client = new Client({
            intents: [GatewayIntentBits.Guilds],
        })

        // 10秒のタイムアウトを設定
        const timeout = setTimeout(() => {
            client.destroy()
            resolve(false)
        }, 10000)

        client.once(Events.ClientReady, () => {
            clearTimeout(timeout)
            client.destroy()
            resolve(true)
        })

        client.on('error', () => {
            clearTimeout(timeout)
            client.destroy()
            resolve(false)
        })

        // ログインを試行
        client.login(token).catch(() => {
            clearTimeout(timeout)
            client.destroy()
            resolve(false)
        })
    })
}
