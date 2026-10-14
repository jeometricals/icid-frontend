import { softDeleteTaskOrder, undeleteTaskOrder } from '../services/api'

// How many properties, in the UI's words: "24 sites", "1 site"
export const propertyCount = (count) => `${count} site${count === 1 ? '' : 's'}`

// A task order's two confirmed actions, on its project's list and on its own page: the call, the words of the
// dialog and of the toast once it went through
export const TASK_ORDER_ACTIONS = {
  delete: {
    run: row => softDeleteTaskOrder(row.id),
    title: row => `Delete task order ${row.task_order_number}?`,
    message: () => "It leaves this project's list and its number is freed. Its sites stay bundled, so un-deleting it brings them back too.",
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: row => `Task order ${row.task_order_number} deleted.`,
  },
  undelete: {
    run: row => undeleteTaskOrder(row.id),
    title: row => `Un-delete task order ${row.task_order_number}?`,
    message: row => `It returns to this project's list as ${row.task_order_number}, with its sites.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: row => `Task order ${row.task_order_number} restored.`,
  },
}
