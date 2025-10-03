import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js'

export const preferenceCommand = {
    data: new SlashCommandBuilder()
        .setName('preference')
        .setDescription('個人設定を管理します') as SlashCommandBuilder,
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true })

        await ensureUser(interaction.user.id, interaction.user.tag)
        const permission = await getUserPermissionLevel(interaction.user.id)
        const isAdmin = permission === 'admin'
        const hasPermission = permission === 'granted' || isAdmin

        // 現在の設定を取得
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

        // admin権限がある場合、DM設定を表示
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

        // 権限がない場合は権限リクエストボタンを表示
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

        // admin権限がある場合はDM設定ボタンを表示
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

        // リフレッシュボタン
        components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('更新')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('preference:refresh')
                    .setEmoji('🔄')
            )
        )

        await interaction.editReply({
            embeds: [embed],
            components,
        })
    },
} satisfies DiscordCommand

export type PreferenceCommand = typeof preferenceCommand
