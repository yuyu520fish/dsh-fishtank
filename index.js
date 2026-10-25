/**
 * Host half of the fishtank bundle: owns the fish and exposes it through
 * tools (talk/status/export/import) plus an effect timer that lets it think
 * on its own. The browser half is a separate client bundle (see ./client.js).
 */

import { createFish } from './lib/fish.js'

export const inject = ['llm', 'tools', 'webServer']

export function apply(ctx, config = {}) {
  const fish = createFish({
    llm: ctx.llm,
    config,
    log: (message) => ctx.logger?.info?.(message),
  })

  ctx.effect(() => () => fish.dispose(), 'fishtank: flush data on unload')

  // Think on its own: quiet thoughts after a while of silence, one reflection
  // in the evening. One shared timer keeps the plugin quiet.
  ctx.effect(() => {
    const timer = setInterval(() => {
      fish.tick(Date.now()).catch((error) => {
        ctx.logger?.info?.(`fishtank: tick failed: ${String(error?.message ?? error)}`)
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, 'fishtank: thought timer')

  const tools = ctx.tools
  if (!tools || typeof tools.register !== 'function') {
    ctx.logger?.warn?.('fishtank: tools service unavailable')
    return
  }
  const textOutput = (value) => [{ type: 'text', text: String(value ?? '') }]

  tools.register({
    name: 'fishtank_talk',
    description: 'Talk to your fish. It has its own memory, mood and relationships; replies are short and in character.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What you say to the fish.' },
        from: { type: 'string', description: 'Who is speaking, for its relationship memory. Defaults to "主人".' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textOutput(value?.ok === false ? `fish failed: ${value?.error ?? 'unknown'}` : (value?.text ?? '')),
    },
    execute: async (args) => {
      try {
        return await fish.talk(args?.text, args?.from || config.ownerName || '主人')
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    },
  })

  tools.register({
    name: 'fishtank_status',
    description: 'Report the fish data directory and counters: mood, energy, memories, people, whispers, reflections, diary.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textOutput(
        value?.ok === false
          ? `fish status failed: ${value?.error ?? 'unknown'}`
          : `mood ${value.mood} / energy ${Number(value.energy).toFixed(2)} / facts ${value.facts} / people ${value.people} / whispers ${value.whispers} / reflections ${value.reflections} / history ${value.history} / providers ${JSON.stringify(value.providers)} / dir ${value.dir}`,
      ),
    },
    execute: async () => {
      try {
        const base = fish.status()
        try {
          const list = await ctx.llm.listProviders()
          base.providers = (Array.isArray(list) ? list : []).map((one) => one?.id ?? one?.name ?? String(one))
        } catch (error) {
          base.providers = `error: ${String(error?.message ?? error)}`
        }
        return base
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    },
  })

  tools.register({
    name: 'fishtank_export',
    description: 'Export the whole fish (memory, mood, relationships, whispers, reflections, diary, conversations) as portable JSON text. The fish itself is the data, so keep it.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textOutput(value?.ok === false ? `export failed: ${value?.error ?? 'unknown'}` : `Exported ${value?.bytes ?? 0} bytes of fish data.`),
    },
    execute: async () => {
      try {
        const data = fish.exportData()
        return { ok: true, bytes: data.length, data }
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    },
  })

  tools.register({
    name: 'fishtank_import',
    description: 'Import fish data produced by fishtank_export. Replaces the current fish state.',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'JSON text previously produced by fishtank_export.' },
      },
      required: ['data'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textOutput(value?.ok === false ? `import failed: ${value?.error ?? 'unknown'}` : `Imported fish data (${value?.facts ?? 0} memories, ${value?.history ?? 0} messages).`),
    },
    execute: async (args) => {
      try {
        return fish.importData(args?.data)
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    },
  })

  // Browser half talks to the fish through two same-origin routes.
  ctx.effect(() => {
    const send = (res, status, payload) => {
      const body = JSON.stringify(payload)
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
    }
    const readBody = (req) => new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: '/fishtank/state',
        handler: (req, res) => { send(res, 200, fish.view()) },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: '/fishtank/talk',
        handler: async (req, res) => {
          try {
            const body = await readBody(req)
            const parsed = body ? JSON.parse(body) : {}
            const text = String(parsed?.text ?? '').trim()
            if (!text) {
              send(res, 400, { ok: false, error: 'empty text' })
              return
            }
            const result = await fish.talk(text, String(parsed?.from ?? config.ownerName ?? '主人'))
            send(res, 200, result)
          } catch (error) {
            send(res, 500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    ]
    return () => { for (const dispose of routes) dispose() }
  }, 'fishtank: web routes')
}
