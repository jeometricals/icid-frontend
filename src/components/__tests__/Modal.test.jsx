import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../Modal'

function renderModal(props = {}) {
  const onClose = vi.fn()
  const result = render(
    <Modal title="Add attachment" onClose={onClose} footer={<button>Save</button>} {...props}>
      <p>Body text</p>
    </Modal>
  )
  return { onClose, ...result }
}

describe('Modal', () => {
  it('renders a dialog labelled by its title, with its children and footer', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Add attachment' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Body text')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('renders into document.body, outside the component tree', () => {
    const { container } = renderModal()
    expect(container).toBeEmptyDOMElement()
    expect(document.body).toContainElement(screen.getByRole('dialog'))
  })

  it('closes on the X button', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const { onClose } = renderModal()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop click but not on a click inside the panel', () => {
    const { onClose } = renderModal()
    fireEvent.mouseDown(screen.getByText('Body text'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape, the backdrop and the X while busy', async () => {
    const { onClose } = renderModal({ busy: true })
    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement)
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves out the footer bar when no footer is given', () => {
    renderModal({ footer: undefined })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
