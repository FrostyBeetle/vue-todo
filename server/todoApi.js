// A tiny save API inside the Vite server: GET/PUT /api/todos, stored in one JSON file.
// Every device that opens the site reads and writes this same file, so they stay in sync.
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_BODY = 1024 * 1024 // 1 MB is far more than any to-do list needs

function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY) reject(new Error('Body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function isValidList(items) {
  return Array.isArray(items) && items.every((t) =>
    t && typeof t === 'object' && typeof t.title === 'string' && typeof t.done === 'boolean')
}

export function todoApi(file) {
  async function handle(req, res, next) {
    if (req.url.split('?')[0] !== '/api/todos') return next()

    try {
      if (req.method === 'GET') {
        let text
        try {
          text = await fs.readFile(file, 'utf8')
        } catch (err) {
          if (err.code === 'ENOENT') return send(res, 404, { error: 'Nothing saved yet' })
          throw err
        }
        return send(res, 200, JSON.parse(text))
      }

      if (req.method === 'PUT') {
        let items
        try {
          items = JSON.parse(await readBody(req))
        } catch {
          return send(res, 400, { error: 'Invalid JSON' })
        }
        if (!isValidList(items)) return send(res, 400, { error: 'Expected a list of to-dos' })

        // Write to a temp file first, then rename: a crash can never leave half a file
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(`${file}.tmp`, JSON.stringify(items, null, 2))
        await fs.rename(`${file}.tmp`, file)
        return send(res, 200, items)
      }

      send(res, 405, { error: 'Method not allowed' })
    } catch (err) {
      send(res, 500, { error: err.message })
    }
  }

  return {
    name: 'todo-api',
    handle,
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}
