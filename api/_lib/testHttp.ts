/** Test-only fake req/res for exercising api/*.ts handlers directly. */
import type { ApiRequest, ApiResponse } from './http'

export function fakeReq(partial: ApiRequest): ApiRequest {
  return { method: 'GET', ...partial }
}

export function fakeRes(): { res: ApiResponse; status: () => number | undefined; body: () => unknown } {
  let statusCode: number | undefined
  let jsonBody: unknown
  const res: ApiResponse = {
    status(code) {
      statusCode = code
      return res
    },
    json(body) {
      jsonBody = body
    },
  }
  return { res, status: () => statusCode, body: () => jsonBody }
}
