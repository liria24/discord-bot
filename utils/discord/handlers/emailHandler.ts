import type { ModalSubmitInteraction } from 'discord.js'

const COMPONENT_PREFIX = 'email'

export const handleEmailModal = async (interaction: ModalSubmitInteraction): Promise<boolean> => {
    if (!interaction.customId.startsWith(`${COMPONENT_PREFIX}:`)) {
        return false
    }

    const [, action] = interaction.customId.split(':')

    if (action === 'add-modal') {
        return await handleAddEmailModal(interaction)
    }

    return false
}

async function handleAddEmailModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    await interaction.deferReply({ ephemeral: true })

    const name = interaction.fields.getTextInputValue('name')
    const email = interaction.fields.getTextInputValue('email')
    const hostInput = interaction.fields.getTextInputValue('host')
    const userInput = interaction.fields.getTextInputValue('user')
    const password = interaction.fields.getTextInputValue('password')

    // ホストとポートをパース（host:port形式に対応）
    let imapHost = hostInput
    let imapPort: number | undefined

    if (hostInput.includes(':')) {
        const [host, port] = hostInput.split(':')
        imapHost = host
        const parsedPort = Number.parseInt(port, 10)
        if (!Number.isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
            imapPort = parsedPort
        }
    }

    // ユーザー名が未入力の場合はメールアドレスを使用
    const imapUser = userInput.trim() || email

    try {
        const account = await createEmailAccount({
            name,
            email,
            imapHost,
            imapPort,
            imapUser,
            imapPassword: password,
        })

        await interaction.editReply(
            `✅ メールアカウント「${account.name}」(${account.email})を追加しました。`
        )
    } catch (error) {
        console.error('Failed to create email account', error)
        await interaction.editReply(
            'メールアカウントの追加に失敗しました。入力内容を確認してください。'
        )
    }

    return true
}
