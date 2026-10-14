import { softDeleteTaskOrder, undeleteTaskOrder } from '../services/api'

// "24 properties", "1 property"
export const propertyCount = (count) => `${count} propert${count === 1 ? 'y' : 'ies'}`

// A task order's two confirmed actions, on its project's list and on its own page: the call, the words of the
// dialog and of the toast once it went through
export const TASK_ORDER_ACTIONS = {
  delete: {
    run: row => softDeleteTaskOrder(row.id),
    title: row => `Delete task order ${row.task_order_number}?`,
    message: () => "It leaves this project's list and its number is freed. Its properties stay bundled, so un-deleting it brings them back too.",
    confirmLabel: 'Delete',
    confirmClassName: 'btn-danger',
    done: row => `Task order ${row.task_order_number} deleted.`,
  },
  undelete: {
    run: row => undeleteTaskOrder(row.id),
    title: row => `Un-delete task order ${row.task_order_number}?`,
    message: row => `It returns to this project's list as ${row.task_order_number}, with its properties.`,
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    done: row => `Task order ${row.task_order_number} restored.`,
  },
}
