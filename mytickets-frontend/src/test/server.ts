import { setupServer } from 'msw/node'

/** Pretends to be the API. Each test adds the answers it needs with `server.use(...)`. */
export const server = setupServer()
