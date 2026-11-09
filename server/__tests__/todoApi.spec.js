// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { todoApi } from '../todoApi.js'

let dir, server, base

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-api-'))
  const { handle } = todoApi(path.join(dir, 'data', 'todos.json'))
  server = http.createServer((req, res) => handle(req, res, () => {
    res.statusCode = 418
    res.end()
  }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  await fs.rm(dir, { recursive: true, force: true })
})

const put = (body) => fetch(`${base}/api/todos`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

describe('todo API', () => {
  it('answers 404 before anything was saved', async () => {
    const res = await fetch(`${base}/api/todos`)
    expect(res.status).toBe(404)
  })

  it('saves a list and returns it again', async () => {
    const items = [{ id: 1, title: 'Milk', done: false }]
    expect((await put(items)).status).toBe(200)

    const res = await fetch(`${base}/api/todos`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(items)
  })

  it('rejects bad data and keeps the old list', async () => {
    await put([{ id: 1, title: 'Keep me', done: false }])

    expect((await put('{broken')).status).toBe(400)
    expect((await put({ not: 'a list' })).status).toBe(400)
    expect((await put([{ id: 2, title: 42, done: false }])).status).toBe(400)

    const res = await fetch(`${base}/api/todos`)
    expect(await res.json()).toEqual([{ id: 1, title: 'Keep me', done: false }])
  })

  it('keeps a priority and rejects an unknown one', async () => {
    const items = [{ id: 1, title: 'Milk', done: false, priority: 'high' }]
    expect((await put(items)).status).toBe(200)
    expect((await put([{ id: 2, title: 'X', done: false, priority: 'urgent' }])).status).toBe(400)

    const res = await fetch(`${base}/api/todos`)
    expect(await res.json()).toEqual(items)
  })

  it('leaves other URLs to the next handler', async () => {
    const res = await fetch(`${base}/something-else`)
    expect(res.status).toBe(418)
  })
})
