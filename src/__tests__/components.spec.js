import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import App from '../App.vue'
import AppHeader from '../components/AppHeader.vue'
import TodoList from '../components/TodoList.vue'
import TodoItem from '../components/TodoItem.vue'

enableAutoUnmount(afterEach)

describe('App is built from components', () => {
  beforeEach(() => {
    localStorage.clear()
    // No server in these tests: every fetch fails, so the app just works offline
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses AppHeader, TodoList and one TodoItem per to-do', async () => {
    localStorage.setItem('vue-todo:items', JSON.stringify([
      { id: 1, title: 'A', done: false },
      { id: 2, title: 'B', done: true },
    ]))
    const wrapper = mount(App)
    expect(wrapper.findComponent(AppHeader).exists()).toBe(true)
    expect(wrapper.findComponent(TodoList).exists()).toBe(true)
    expect(wrapper.findAllComponents(TodoItem)).toHaveLength(2)
  })
})

describe('AppHeader', () => {
  it('shows the offline label only when offline is true', async () => {
    const wrapper = mount(AppHeader, { props: { offline: false } })
    expect(wrapper.find('[data-test="offline"]').exists()).toBe(false)
    await wrapper.setProps({ offline: true })
    expect(wrapper.find('[data-test="offline"]').exists()).toBe(true)
  })
})

describe('TodoItem', () => {
  const todo = { id: 7, title: 'Walk the dog', done: false }

  it('shows the title and tells the parent about toggle and delete', async () => {
    const wrapper = mount(TodoItem, { props: { todo } })
    expect(wrapper.get('[data-test="title"]').text()).toBe('Walk the dog')

    await wrapper.get('[data-test="toggle"]').setValue(true)
    await wrapper.get('[data-test="delete"]').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(todo.done).toBe(false) // the item never changes its prop itself
  })

  it('emits rename with the new title after editing', async () => {
    const wrapper = mount(TodoItem, { props: { todo } })
    await wrapper.get('[data-test="title"]').trigger('dblclick')
    const edit = wrapper.get('[data-test="edit"]')
    await edit.setValue('  Feed the cat ')
    await edit.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rename')).toEqual([['Feed the cat']])
    expect(wrapper.emitted('editing')).toEqual([[true], [false]])
  })
})
