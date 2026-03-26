import { getReasonPhrase, StatusCodes } from 'http-status-codes'
import { defineHandler, HTTPError, type H3Event } from 'nitro/h3'

type ApiKeyRecord = NonNullable<Awaited<ReturnType<typeof verifyApiKey>>>
type HandlerArgs = { event: H3Event; apiKeyRecord: ApiKeyRecord }

const httpError = (status: StatusCodes, message: string) =>
    new HTTPError({ status, statusText: getReasonPhrase(status), message })

export const authedHandler = <T = unknown>(handler: (args: HandlerArgs) => Promise<T> | T) =>
    defineHandler(async (event) => {
        const authHeader = event.req.headers.get('authorization')?.trim()

        if (!authHeader?.startsWith('Bearer ')) {
            logger('eventHandler').warn('Missing or invalid Authorization header')
            throw httpError(StatusCodes.UNAUTHORIZED, 'Invalid API key')
        }

        const apiKeyRecord = await verifyApiKey(authHeader.slice('Bearer '.length).trim())

        if (!apiKeyRecord) {
            logger('eventHandler').warn('Unauthorized request with unknown API key prefix')
            throw httpError(StatusCodes.UNAUTHORIZED, 'Invalid API key')
        }

        return handler({ event, apiKeyRecord })
    })

export const adminHandler = <T = unknown>(handler: (args: HandlerArgs) => Promise<T> | T) =>
    authedHandler(async ({ event, apiKeyRecord }) => {
        const { permissionLevel } = apiKeyRecord.user ?? {}

        if (permissionLevel !== 'granted' && permissionLevel !== 'admin') {
            logger('eventHandler').warn('Authenticated user lacks permission to post messages', {
                userId: apiKeyRecord.userId,
            })
            throw httpError(StatusCodes.FORBIDDEN, 'Permission denied')
        }

        return handler({ event, apiKeyRecord })
    })
