#!/usr/bin/env -S node --no-warnings
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import fetch from 'node-fetch'
import parse from './parser.js'

async function test({ request, url }) {
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: request.body })
  })

  let body

  const contentType = response.headers.get('content-type')

  if (contentType.startsWith('text/')) {
    body = await response.text()
  } else if (contentType.indexOf('json') > -1) {
    body = await response.json()
  } else {
    body = Buffer.from(await response.arrayBuffer()).toString('hex')
  }

  return {
    method: request.method,
    url,
    headers: Array.from(response.headers),
    body
  }
}

export function evaluate(id) {
  const [fn, ...args] = id.slice(1).split(/\s+/)

  switch (fn) {
    case 'processEnv': {
      return process.env[args[0]]
    }

    default: {
      throw new Error(`not implemented: $${fn}`)
    }
  }
}

export function interpolate(text, { env = {} } = {}) {
  const brokenAtStart = text?.split('{{') ?? []

  const variables = []

  const segments = [brokenAtStart.shift()]

  for (const start of brokenAtStart) {
    const endIndex = start.indexOf('}}')

    const id = start.slice(0, endIndex)

    variables.push(id)

    if (id[0] === '$') {
      segments.push(evaluate(id))
    } else {
      segments.push(env[process.env.NODE_ENV]?.[id])
    }

    segments.push(start.slice(endIndex + 2))
  }

  return segments.join('')
}

export default {
  process: (src, filename) => {
    const requests = parse(src)

    const envPath = join(
      dirname(filename ?? 'a1c63c96-ad67-4546-8a78-66b9805f10e2'),
      'http-client.env.json'
    )

    const env = existsSync(envPath)
      ? JSON.parse(readFileSync(envPath, 'utf-8'))
      : {}

    return {
      code: `
      ${requests
        .map(request => {
          const url = interpolate(request.url, { env })

          return `
              /**
               * ${filename}
               */
              test('${request.method} ${url}', async () => {
                const outcome = await (${test.toString()})(${JSON.stringify(
                  { env, request, url },
                  null,
                  2
                )})

                expect(outcome).toMatchSnapshot()
              })
            `
        })
        .join('')}
        `
    }
  }
}
