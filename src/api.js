// Talks to the save API in server/todoApi.js
const URL = '/api/todos'

// Returns the saved list, or null when the server has nothing saved yet
export async function fetchTodos() {
  const res = await fetch(URL, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Loading failed (${res.status})`)
  return res.json()
}

export async function saveTodos(items) {
  const res = await fetch(URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!res.ok) throw new Error(`Saving failed (${res.status})`)
}
