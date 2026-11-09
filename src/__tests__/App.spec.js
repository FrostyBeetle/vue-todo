import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'

const KEY = 'vue-todo:items'

// A pretend server behind fetch(): items === null means "nothing saved yet"
let server
function fakeServer(items = null) {
  server = { items, up: true }
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (!server.up) throw new TypeError('Failed to fetch')
    if (options.method === 'PUT') {
      server.items = JSON.parse(options.body)
      return { ok: true, status: 200, json: async () => server.items }
    }
    if (server.items === null) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => structuredClone(server.items) }
  }))
}

enableAutoUnmount(afterEach) // stops each test's sync timers
beforeEach(() => fakeServer())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function addTodo(wrapper, text) {
  const input = wrapper.get('[data-test="new"]')
  await input.setValue(text)
  await input.trigger('keydown', { key: 'Enter' })
}

const titles = (wrapper) => wrapper.findAll('[data-test="title"]').map((t) => t.text())

describe('To-do app', () => {
  beforeEach(() => localStorage.clear())

  it('adds a to-do on Enter, trims it and clears the input', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, '  Buy milk  ')
    expect(titles(wrapper)).toEqual(['Buy milk'])
    expect(wrapper.get('[data-test="new"]').element.value).toBe('')
  })

  it('ignores empty input', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, '   ')
    expect(titles(wrapper)).toEqual([])
  })

  it('marks a to-do done and updates the count', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, 'A')
    await addTodo(wrapper, 'B')
    expect(wrapper.get('[data-test="count"]').text()).toBe('2 left')
    await wrapper.findAll('[data-test="toggle"]')[0].setValue(true)
    expect(wrapper.get('[data-test="count"]').text()).toBe('1 left')
  })

  it('deletes a to-do', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, 'A')
    await addTodo(wrapper, 'B')
    await wrapper.findAll('[data-test="delete"]')[0].trigger('click')
    expect(titles(wrapper)).toEqual(['B'])
  })

  it('filters active and done to-dos', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, 'A')
    await addTodo(wrapper, 'B')
    await wrapper.findAll('[data-test="toggle"]')[0].setValue(true)

    await wrapper.get('[data-test="filter-active"]').trigger('click')
    expect(titles(wrapper)).toEqual(['B'])
    await wrapper.get('[data-test="filter-done"]').trigger('click')
    expect(titles(wrapper)).toEqual(['A'])
    await wrapper.get('[data-test="filter-all"]').trigger('click')
    expect(titles(wrapper)).toEqual(['A', 'B'])
  })

  it('clears completed to-dos', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, 'A')
    await addTodo(wrapper, 'B')
    await wrapper.findAll('[data-test="toggle"]')[0].setValue(true)
    await wrapper.get('[data-test="clear"]').trigger('click')
    expect(titles(wrapper)).toEqual(['B'])
  })

  it('edits a to-do on double-click: Enter saves, Escape cancels, empty deletes', async () => {
    const wrapper = mount(App)
    await addTodo(wrapper, 'Old')

    await wrapper.get('[data-test="title"]').trigger('dblclick')
    let edit = wrapper.get('[data-test="edit"]')
    await edit.setValue('New')
    await edit.trigger('keydown', { key: 'Enter' })
    expect(titles(wrapper)).toEqual(['New'])

    await wrapper.get('[data-test="title"]').trigger('dblclick')
    edit = wrapper.get('[data-test="edit"]')
    await edit.setValue('Ignored')
    await edit.trigger('keydown', { key: 'Escape' })
    expect(titles(wrapper)).toEqual(['New'])

    await wrapper.get('[data-test="title"]').trigger('dblclick')
    edit = wrapper.get('[data-test="edit"]')
    await edit.setValue('  ')
    await edit.trigger('keydown', { key: 'Enter' })
    expect(titles(wrapper)).toEqual([])
  })

  it('saves to localStorage and loads it back', async () => {
    const first = mount(App)
    await addTodo(first, 'Remember me')
    await first.findAll('[data-test="toggle"]')[0].setValue(true)
    await nextTick()
    first.unmount()

    const second = mount(App)
    expect(titles(second)).toEqual(['Remember me'])
    expect(second.get('[data-test="toggle"]').element.checked).toBe(true)
  })

  it('starts empty when saved data is broken', () => {
    localStorage.setItem(KEY, '{not json')
    const wrapper = mount(App)
    expect(titles(wrapper)).toEqual([])
  })
})

describe('Syncing with the PC', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  const serverTitles = () => server.items.map((t) => t.title)

  it('loads the list from the server on start', async () => {
    fakeServer([{ id: 1, title: 'From my phone', done: false }])
    const wrapper = mount(App)
    await flushPromises()
    expect(titles(wrapper)).toEqual(['From my phone'])
  })

  it('sends changes to the server', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await addTodo(wrapper, 'A')
    await vi.advanceTimersByTimeAsync(500)
    expect(serverTitles()).toEqual(['A'])
  })

  it('picks up changes made on another device', async () => {
    fakeServer([{ id: 1, title: 'Old', done: false }])
    const wrapper = mount(App)
    await flushPromises()

    server.items = [{ id: 1, title: 'Old', done: true }, { id: 2, title: 'New on phone', done: false }]
    await vi.advanceTimersByTimeAsync(3500)
    expect(titles(wrapper)).toEqual(['Old', 'New on phone'])
    expect(wrapper.get('[data-test="count"]').text()).toBe('1 left')
  })

  it('uploads the local list when the server has none yet', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 1, title: 'Saved before sync', done: false }]))
    mount(App)
    await vi.advanceTimersByTimeAsync(500)
    expect(serverTitles()).toEqual(['Saved before sync'])
  })

  it('keeps changes made while offline and sends them later', async () => {
    fakeServer([])
    const wrapper = mount(App)
    await flushPromises()

    server.up = false
    await addTodo(wrapper, 'Made offline')
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.find('[data-test="offline"]').exists()).toBe(true)

    server.up = true
    await vi.advanceTimersByTimeAsync(3500)
    expect(serverTitles()).toEqual(['Made offline'])
    expect(titles(wrapper)).toEqual(['Made offline'])
    expect(wrapper.find('[data-test="offline"]').exists()).toBe(false)
  })

  it('sends offline changes after a reload instead of losing them', async () => {
    fakeServer([])
    const first = mount(App)
    await flushPromises()
    server.up = false
    await addTodo(first, 'Made offline')
    await vi.advanceTimersByTimeAsync(500)
    first.unmount()

    server.up = true
    const second = mount(App)
    await vi.advanceTimersByTimeAsync(500)
    expect(titles(second)).toEqual(['Made offline'])
    expect(serverTitles()).toEqual(['Made offline'])
  })

  it('does not interrupt editing when the server changes', async () => {
    fakeServer([{ id: 1, title: 'Edit me', done: false }])
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-test="title"]').trigger('dblclick')
    server.items = [{ id: 1, title: 'Edit me', done: false }, { id: 2, title: 'Other', done: false }]
    await vi.advanceTimersByTimeAsync(3500)
    expect(wrapper.find('[data-test="edit"]').exists()).toBe(true)
  })
})

describe('Touch screens (iPhone)', () => {
  beforeEach(() => localStorage.clear())

  function pretendTouchScreen(isTouch) {
    vi.stubGlobal('matchMedia', (query) => ({
      matches: isTouch && query === '(hover: none)',
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
  }

  it('starts editing with a single tap on a touch screen', async () => {
    pretendTouchScreen(true)
    const wrapper = mount(App)
    await addTodo(wrapper, 'Tap me')
    await wrapper.get('[data-test="title"]').trigger('click')
    expect(wrapper.find('[data-test="edit"]').exists()).toBe(true)
  })

  it('needs a double-click on a PC, so a single click does nothing', async () => {
    pretendTouchScreen(false)
    const wrapper = mount(App)
    await addTodo(wrapper, 'Click me')
    await wrapper.get('[data-test="title"]').trigger('click')
    expect(wrapper.find('[data-test="edit"]').exists()).toBe(false)
  })
})
