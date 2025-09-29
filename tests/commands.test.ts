import { describe, expect, test } from 'bun:test'

describe('discordCommands', () => {
    test('includes hello command', () => {
        const hello = discordCommands.find(
            (command) => command.data.name === 'hello'
        )

        expect(hello).toBeDefined()
        expect(hello?.data.description).toBe(
            'Replies with a friendly greeting.'
        )
    })
})
