import { describe, expect, test } from 'bun:test'
import { discordCommands } from '../utils/discord/commands'

describe('discordCommands', () => {
    test('includes help command', () => {
        const command = discordCommands.find((item) => item.data.name === 'help')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('ヘルプ')
    })

    test('includes api-key command', () => {
        const command = discordCommands.find((item) => item.data.name === 'api-key')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('APIキー')
    })

    test('includes preference command', () => {
        const command = discordCommands.find((item) => item.data.name === 'preference')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('設定')
    })

    test('includes status command', () => {
        const command = discordCommands.find((item) => item.data.name === 'status')

        expect(command).toBeDefined()
        expect(command?.data.description).toContain('ステータス')
    })
})
