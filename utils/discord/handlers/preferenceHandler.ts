import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js'

const COMPONENT_PREFIX = 'preference'

const buildButtonCustomId = (action: 'approve' | 'reject', id: string) =>
    `perm-request:${action}:${id}`

export const handlePreferenceButton = async (interaction: ButtonInteraction): Promise<boolean> => {
    if (!interaction.customId.startsWith(`${COMPONENT_PREFIX}:`)) {
        return false
    }

    const [, action] = interaction.customId.split(':')

    if (!action) {
        await interaction.reply({
            content: '無効な操作です。',
            ephemeral: true,
        })
        return true
    }

    await ensureUser(interaction.user.id, interaction.user.tag)

    if (action === 'request-access') {
        return await handleRequestAccess(interaction)
    } else if (action === 'toggle-admin-dm') {
        return await handleToggleAdminDm(interaction)
    } else if (action === 'refresh') {
        return await handleRefresh(interaction)
    }

    await interaction.reply({
        content: 'この操作はサポートされていません。',
        ephemeral: true,
    })
    return true
}

async function handleRequestAccess(interaction: ButtonInteraction): Promise<boolean> {
    const permission = await getUserPermissionLevel(interaction.user.id)

    if (permission === 'admin' || permission === 'granted') {
        await interaction.reply({
            content: 'すでに API キー発行権限を所持しています。',
            ephemeral: true,
        })
        return true
    }

    const existingRequest = await findPendingRequestByRequester(interaction.user.id)

    if (existingRequest) {
        await interaction.reply({
            content: '申請は既に受け付け済みです。管理者からの回答をお待ちください。',
            ephemeral: true,
        })
        return true
    }

    const admins = await listUsersByPermission('admin')

    if (!admins.length) {
        await interaction.reply({
            content: '現在この申請を処理できる管理者が登録されていません。',
            ephemeral: true,
        })
        return true
    }

    const request = await createPermissionRequest(interaction.user.id)

    const embed = new EmbedBuilder()
        .setTitle('API権限リクエスト')
        .setDescription(
            `${interaction.user.tag} (${interaction.user.id}) が granted 権限をリクエストしました。`
        )
        .addFields({ name: 'リクエストID', value: request.id })
        .setColor(0xf1c40f)
        .setTimestamp()

    let savedMessageId: string | undefined

    for (const admin of admins) {
        try {
            const adminUser = await interaction.client.users.fetch(admin.id)
            const components = [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel('許可')
                        .setStyle(ButtonStyle.Success)
                        .setCustomId(buildButtonCustomId('approve', request.id)),
                    new ButtonBuilder()
                        .setLabel('拒否')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(buildButtonCustomId('reject', request.id))
                ),
            ]

            const message = await adminUser.send({
                content: '新しい API 権限リクエストがあります。',
                embeds: [embed],
                components,
            })

            if (!savedMessageId) {
                savedMessageId = message.id
            }
        } catch (error) {
            console.error('Failed to notify admin about access request', {
                adminId: admin.id,
                error,
            })
        }
    }

    if (savedMessageId) {
        await saveAdminMessageId(request.id, savedMessageId)
    }

    await interaction.reply({
        content: '申請を管理者に送信しました。結果が届くまでお待ちください。',
        ephemeral: true,
    })

    return true
}

async function handleToggleAdminDm(interaction: ButtonInteraction): Promise<boolean> {
    const permission = await getUserPermissionLevel(interaction.user.id)

    if (permission !== 'admin') {
        await interaction.reply({
            content: 'この操作を実行する権限がありません。admin権限が必要です。',
            ephemeral: true,
        })
        return true
    }

    const currentOptOut = await getAdminDmOptOut(interaction.user.id)
    const newOptOut = !currentOptOut

    await setAdminDmOptOut(interaction.user.id, newOptOut)

    await interaction.reply({
        content: newOptOut
            ? '✅ admin-messageからのDM通知を無効化しました。'
            : '✅ admin-messageからのDM通知を有効化しました。',
        ephemeral: true,
    })

    // 設定パネルを更新
    await handleRefresh(interaction, true)

    return true
}

async function handleRefresh(interaction: ButtonInteraction, isFollowUp = false): Promise<boolean> {
    const permission = await getUserPermissionLevel(interaction.user.id)
    const isAdmin = permission === 'admin'
    const hasPermission = permission === 'granted' || isAdmin

    const dmOptOut = await getAdminDmOptOut(interaction.user.id)

    const embed = new EmbedBuilder()
        .setTitle('⚙️ 個人設定')
        .setDescription('ボタンをクリックして設定を変更できます。')
        .setColor(0x5865f2)
        .addFields({
            name: '🔐 権限レベル',
            value: hasPermission
                ? `**${permission}** - APIキーの管理が可能です`
                : '**なし** - APIキーを管理するには権限が必要です',
            inline: false,
        })
        .setTimestamp()

    if (isAdmin) {
        embed.addFields({
            name: '📬 Admin通知DM',
            value: dmOptOut
                ? '❌ **無効** - admin-messageからのDMを受け取りません'
                : '✅ **有効** - admin-messageからのDMを受け取ります',
            inline: false,
        })
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = []

    if (!hasPermission) {
        components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('権限をリクエスト')
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId('preference:request-access')
                    .setEmoji('📝')
            )
        )
    }

    if (isAdmin) {
        components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel(dmOptOut ? 'DM通知を有効化' : 'DM通知を無効化')
                    .setStyle(dmOptOut ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setCustomId('preference:toggle-admin-dm')
                    .setEmoji('📬')
            )
        )
    }

    components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('更新')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('preference:refresh')
                .setEmoji('🔄')
        )
    )

    if (isFollowUp) {
        // すでにreplyしている場合は、元のメッセージを更新
        await interaction.editReply({
            embeds: [embed],
            components,
        })
    } else {
        await interaction.update({
            embeds: [embed],
            components,
        })
    }

    return true
}
