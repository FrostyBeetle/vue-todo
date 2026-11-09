// The three priority levels, from most to least important.
// The key is what gets saved; the label is what you see.
export const PRIORITIES = { high: 'High', medium: 'Medium', low: 'Low' }

const ORDER = Object.keys(PRIORITIES) // ['high', 'medium', 'low']

// To-dos saved before priorities existed have none: treat them as Medium
export function priorityOf(todo) {
  return todo.priority in PRIORITIES ? todo.priority : 'medium'
}

// Position in the list: High = 0 comes first
export function rank(todo) {
  return ORDER.indexOf(priorityOf(todo))
}

// Clicking the label goes High → Medium → Low → High
export function nextPriority(priority) {
  return ORDER[(ORDER.indexOf(priority) + 1) % ORDER.length]
}
