import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PirPage, { IMAGE_FAILED_TEXT, NO_PAGES_READ_ONLY, NO_PIR_TEXT, scaleText } from '../PirPage'
import { UPLOAD_PROMPT } from '../../components/PirUploadModal'
import { PIR_DEMO_NOTE } from '../../lib/pirs'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

vi.mock('../../services/api', async (importOriginal) => {
  const { nextRotation } = await importOriginal()
  return {
    nextRotation,
    getProperty: vi.fn(), getPirByProperty: vi.fn(), listPirPages: vi.fn(), deletePirPages: vi.fn(),
    setPirPageRotation: vi.fn(), setPirPageScale: vi.fn(),
    listFlags: vi.fn(), getContractItems: vi.fn(), createFlagOnPage: vi.fn(), updateFlag: vi.fn(), deleteFlag: vi.fn(),
    listPirFeatures: vi.fn(), listPirSegments: vi.fn(), listFlagNonAssessableAreas: vi.fn(),
    getPageTitleBlock: vi.fn(), updatePirTitleBlock: vi.fn(),
    getPropertyPayItemSummary: vi.fn(),
  }
})
vi.mock('../../components/PirUploadModal', async (importOriginal) => ({
  ...(await importOriginal()),
  default: ({ replacing, onUploaded, onClose }) => (
    <div role="dialog" aria-label={replacing ? 'Replace PIR' : 'Upload PIR'}>
      <button type="button" onClick={() => onUploaded({ id: 'pir', pages: [page(1, { pir_page_id: 'new-1' }), page(2, { pir_page_id: 'new-2' })] })}>
        Finish upload
      </button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}))

const ADMIN = { ...TEST_USER, role: 'admin' }
const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000001'
const REPORT_URL = '/project/HWS0023/idr/idr-1/swcb/rep-1'
const PIR = { id: 'e0000000-0000-4000-8000-000000000001', property_id: PROPERTY_ID, project_id: 'HWS0023', as_built_signed_at: null }
const page = (number, extra = {}) => ({
  pir_page_id: `page-${number}`, pir_id: PIR.id, page_number: number, image_url: `https://s/p${number}.png`,
  width_px: 1200, height_px: 800, scale_px_per_ft: 15, rotation_deg: 0, ...extra,
})

let property
let pages

beforeEach(() => {
  vi.clearAllMocks()
  api.getPropertyPayItemSummary.mockResolvedValue([])
  property = { id: PROPERTY_ID, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45', address: '12 Main St',
    display_address: '12 Main St', deleted_at: null }
  pages = [page(1), page(2, { scale_px_per_ft: null }), page(3)]
  api.getProperty.mockImplementation(async () => structuredClone(property))
  api.getPirByProperty.mockResolvedValue(PIR)
  api.listPirPages.mockImplementation(async () => structuredClone(pages))
  api.setPirPageRotation.mockImplementation(async (id, rotation) => ({ ...pages.find(p => p.pir_page_id === id), rotation_deg: rotation }))
  api.setPirPageScale.mockImplementation(async (id, scale) => ({ ...pages.find(p => p.pir_page_id === id), scale_px_per_ft: scale }))
  api.deletePirPages.mockResolvedValue(undefined)
  api.listFlags.mockResolvedValue([])
  api.getContractItems.mockResolvedValue([])
  api.listPirFeatures.mockResolvedValue([])
  api.listPirSegments.mockResolvedValue([])
  api.getPageTitleBlock.mockResolvedValue(null) // page 1 has no title block unless a test gives it one
})

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname}{location.search}</div>
}

function renderPage({ user = TEST_USER, search = '' } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/properties/${PROPERTY_ID}/pir${search}`]}>
      <Routes>
        <Route path="/project/:projectId/properties/:propertyId/pir" element={<><PirPage /><CurrentUrl /></>} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoaded(options) {
  renderPage(options)
  await screen.findByRole('heading', { name: /PIR · 12 Main St/ })
}

const shownImage = () => screen.getByRole('img', { name: /PIR page \d/ })
const pageBox = () => screen.getByTestId('page-box')

describe('PirPage — loading', () => {
  it('reads the site, its live PIR and its pages, and shows page 1 of N', async () => {
    await renderLoaded()
    expect(api.getProperty).toHaveBeenCalledWith(PROPERTY_ID)
    expect(api.getPirByProperty).toHaveBeenCalledWith(PROPERTY_ID)
    expect(api.listPirPages).toHaveBeenCalledWith(PIR.id)
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(shownImage()).toHaveAttribute('src', 'https://s/p1.png')
    expect(screen.getByText('Scale: 15 px/ft')).toBeInTheDocument()
  })

  it("shows a non-member's 403 as the load error, with Retry", async () => {
    api.getProperty.mockRejectedValueOnce(Object.assign(new Error('Not a member of this project'), { status: 403 }))
    renderPage()
    expect(await screen.findByText("Couldn't load the PIR: Not a member of this project")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('says so when the site has no PIR', async () => {
    api.getPirByProperty.mockResolvedValue(null)
    await renderLoaded()
    expect(screen.getByText(NO_PIR_TEXT)).toBeInTheDocument()
    expect(api.listPirPages).not.toHaveBeenCalled()
  })

  it('goes back to the site, or to the project', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Queens Block 123 Lot 45' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/properties/${PROPERTY_ID}`)
  })

  it('offers no Back to report without a returnTo', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: 'Back to report' })).not.toBeInTheDocument()
  })

  it('goes back to the report it was opened from, keeping its own back buttons', async () => {
    await renderLoaded({ search: `?page=2&returnTo=${encodeURIComponent(REPORT_URL)}` })
    expect(screen.getByRole('button', { name: 'Back to Site Queens Block 123 Lot 45' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to report' }))
    expect(screen.getByTestId('url')).toHaveTextContent(REPORT_URL)
  })

  it('carries returnTo along on Back to Site', async () => {
    await renderLoaded({ search: `?returnTo=${encodeURIComponent(REPORT_URL)}` })
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Queens Block 123 Lot 45' }))
    expect(screen.getByTestId('url')).toHaveTextContent(
      `/project/HWS0023/properties/${PROPERTY_ID}?returnTo=${encodeURIComponent(REPORT_URL)}`)
  })

  it('ignores a returnTo outside the app', async () => {
    await renderLoaded({ search: `?returnTo=${encodeURIComponent('https://evil.example/project/x')}` })
    expect(screen.queryByRole('button', { name: 'Back to report' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Site Queens Block 123 Lot 45' }))
    expect(screen.getByTestId('url').textContent).toBe(`/project/HWS0023/properties/${PROPERTY_ID}`)
  })

  it("heads a ped ramp's workspace with its intersection, and names it so on Back", async () => {
    const name = 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)'
    property = { ...property, kind: 'ped_ramp', block: null, lot: null, address: null, display_address: name }
    renderPage()
    expect(await screen.findByRole('heading', { name: `PIR · ${name} Signed by DOT` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Back to Site ${name}` })).toBeInTheDocument()
  })

  it('offers "Reload pages" when an image fails to load (an expired link), which reads the pages again', async () => {
    await renderLoaded()
    fireEvent.error(shownImage())
    expect(screen.getByText(IMAGE_FAILED_TEXT)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload pages' }))
    expect(await screen.findByRole('img', { name: 'PIR page 1' })).toBeInTheDocument()
    expect(api.listPirPages).toHaveBeenCalledTimes(2)
  })
})

describe('PirPage — moving between pages', () => {
  it('goes forward and back with the buttons, keeping the page in ?page=', async () => {
    await renderLoaded()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(shownImage()).toHaveAttribute('src', 'https://s/p2.png')
    expect(screen.getByTestId('url')).toHaveTextContent('?page=2')
    expect(screen.getByText('Scale: not set')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('opens on the page the URL names, and keeps a page out of range within 1..N', async () => {
    await renderLoaded({ search: '?page=3' })
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })

  it.each([['?page=9', 'Page 3 of 3'], ['?page=0', 'Page 1 of 3'], ['?page=x', 'Page 1 of 3']])('reads %s as %s', async (search, shown) => {
    await renderLoaded({ search })
    expect(screen.getByText(shown)).toBeInTheDocument()
  })

  it('moves with the [ and ] keys, but not while typing in a field', async () => {
    await renderLoaded()
    await userEvent.keyboard(']')
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    await userEvent.keyboard(']]')
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    await userEvent.keyboard('[[')
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Set scale' }))
    await userEvent.type(screen.getByLabelText('Scale (px/ft)'), '[[')
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })
})

describe('PirPage — rotation', () => {
  it('turns the page a quarter at a time, saving each turn on that page, and swaps the box for 90 / 270', async () => {
    await renderLoaded()
    expect(pageBox().style.transform).toContain('rotate(0deg)')
    expect(screen.getByTestId('rotated-page')).toHaveAttribute('data-width', '1200')

    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))
    expect(api.setPirPageRotation).toHaveBeenCalledWith('page-1', 90)
    await waitFor(() => expect(pageBox().style.transform).toContain('rotate(90deg)'))
    expect(screen.getByTestId('rotated-page')).toHaveAttribute('data-width', '800')
    expect(screen.getByTestId('rotated-page')).toHaveAttribute('data-height', '1200')
  })

  it.each([[90, 180], [180, 270], [270, 0]])('goes from %i to %i', async (from, to) => {
    pages[0].rotation_deg = from
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))
    expect(api.setPirPageRotation).toHaveBeenCalledWith('page-1', to)
  })

  it('says so when the turn is refused, and leaves the page as it was', async () => {
    api.setPirPageRotation.mockRejectedValue(new Error('Page is deleted'))
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't rotate page 1: Page is deleted")
    expect(pageBox().style.transform).toContain('rotate(0deg)')
  })
})

describe('PirPage — scale per page', () => {
  it('sets the shown page\'s scale only, saying which page it applies to', async () => {
    await renderLoaded({ search: '?page=2' })
    await userEvent.click(screen.getByRole('button', { name: 'Set scale' }))
    const dialog = screen.getByRole('dialog', { name: 'Page scale' })
    expect(within(dialog).getByText('Applies to page 2.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Scale (px/ft)'), '22.5')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(api.setPirPageScale).toHaveBeenCalledWith('page-2', 22.5)
    expect(await screen.findByText('Scale: 22.5 px/ft')).toBeInTheDocument()
    expect(screen.getByText('Page 2 scale set to 22.5 px/ft.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Scale: 15 px/ft')).toBeInTheDocument()
  })

  it('keeps a refused scale in the dialog', async () => {
    api.setPirPageScale.mockRejectedValue(new Error('scale must be a positive number'))
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Set scale' }))
    const dialog = screen.getByRole('dialog', { name: 'Page scale' })
    await userEvent.clear(within(dialog).getByLabelText('Scale (px/ft)'))
    await userEvent.type(within(dialog).getByLabelText('Scale (px/ft)'), '20')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('scale must be a positive number')
  })

  it('prints a scale with up to two decimals', () => {
    expect(scaleText(15)).toBe('15 px/ft')
    expect(scaleText(12.345)).toBe('12.35 px/ft')
    expect(scaleText(null)).toBe('not set')
  })
})

describe('PirPage — upload, replace and remove', () => {
  it('prompts an upload when the PIR has no pages, then lands on page 1 of the new count', async () => {
    pages = []
    await renderLoaded({ search: '?page=3' })
    expect(screen.getByText(UPLOAD_PROMPT)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload PIR' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Upload PIR' })).getByRole('button', { name: 'Finish upload' }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('?page=1')
    expect(screen.getByText('PIR uploaded: 2 pages.')).toBeInTheDocument()
  })

  it('replaces the pages through the same dialog, titled for a replacement', async () => {
    await renderLoaded({ search: '?page=3' })
    await userEvent.click(screen.getByRole('button', { name: 'Replace PIR' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Replace PIR' })).getByRole('button', { name: 'Finish upload' }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('PIR replaced: 2 pages.')).toBeInTheDocument()
  })

  it('removes the pages once confirmed', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Remove pages' }))
    const dialog = screen.getByRole('dialog', { name: "Remove the PIR's pages?" })
    expect(dialog).toHaveTextContent('All 3 pages and the flags drawn on them are deleted.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(api.deletePirPages).toHaveBeenCalledWith(PIR.id)
    expect(await screen.findByText(UPLOAD_PROMPT)).toBeInTheDocument()
    expect(screen.getByText('PIR pages removed.')).toBeInTheDocument()
  })
})

describe('PirPage — read-only', () => {
  it('gives a demo user the pages and navigation, with the note and every change disabled', async () => {
    await renderLoaded({ user: DEMO_USER })
    expect(screen.getByText(PIR_DEMO_NOTE)).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    for (const name of ['Rotate', 'Set scale', 'Replace PIR', 'Remove pages', 'Calibrate', 'Rectangle', 'Arc']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    await userEvent.keyboard(']')
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('gives a demo user no upload when there are no pages', async () => {
    pages = []
    await renderLoaded({ user: DEMO_USER })
    expect(screen.getByText(NO_PAGES_READ_ONLY)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload PIR' })).not.toBeInTheDocument()
  })

  it("keeps a deleted site's pages from a member, but not from an admin", async () => {
    property.deleted_at = '2026-10-02T09:00:00'
    await renderLoaded()
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeDisabled()
  })

  it('lets an admin change a deleted site\'s pages', async () => {
    property.deleted_at = '2026-10-02T09:00:00'
    await renderLoaded({ user: ADMIN })
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeEnabled()
  })
})

describe('PirPage — the sketch workspace', () => {
  it("jumps from the flags list to a flag's page, in the URL, and selects it there", async () => {
    api.listFlags.mockResolvedValue([{
      id: 'f9', pir_id: PIR.id, pir_page_id: 'page-3', display_order: 7, shape: 'rectangle', dimensions: { L: 5, W: 5 },
      sketch_x: 100, sketch_y: 100, rotation: 0, surveyed_mark: 'number_only', surveyed_is_assessable: true,
      surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false, pay_item_id: null,
      computed_quantity: 25, reported_quantity: null, quantity_delta_reason: null,
    }])
    await renderLoaded()
    const list = await screen.findByRole('region', { name: 'All flags' })
    await userEvent.click(within(list).getAllByRole('row')[1])
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('?page=3')
    expect(screen.getByRole('button', { name: 'Flag #7' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Flag #7' })).toBeInTheDocument()
  })

  const FLAG_ON_3 = {
    id: 'f9', pir_id: PIR.id, project_id: 'HWS0023', pir_page_id: 'page-3', display_order: 7, shape: 'rectangle',
    dimensions: { L: 5, W: 5 }, sketch_x: 100, sketch_y: 100, rotation: 0, surveyed_mark: 'number_only',
    surveyed_is_assessable: true, surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false,
    pay_item_id: null, computed_quantity: 25, reported_quantity: null, quantity_delta_reason: null,
  }

  it("opens on the page and flag the URL names (the IDR page's View in sketch)", async () => {
    api.listFlags.mockResolvedValue([FLAG_ON_3])
    await renderLoaded({ search: '?page=3&flag=f9' })
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(await screen.findByRole('complementary', { name: 'Flag #7' })).toBeInTheDocument()
  })

  it("opens the IDR that claimed a flag from its badge", async () => {
    api.listFlags.mockResolvedValue([{ ...FLAG_ON_3, claimed_by_idr_id: 'idr-9', claimed_by_idr_number: '042' }])
    await renderLoaded({ search: '?page=3' })
    await userEvent.click(await screen.findByRole('link', { name: /Open IDR 042/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-9')
  })

  it('keeps the shape tools off on a page without a scale', async () => {
    await renderLoaded({ search: '?page=2' })
    expect(screen.getByText('Scale: not set')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// The title block (R1h.2)
// ---------------------------------------------------------------------------

describe('PirPage — title block', () => {
  const banner = () => screen.getByLabelText('Title block')
  const editButton = () => screen.getByRole('button', { name: 'Edit title block' })
  const editor = () => screen.getByRole('dialog', { name: 'Title block — Page 1' })

  it("shows page 1's title block and the PIR's bearing in one line", async () => {
    api.getPirByProperty.mockResolvedValue({ ...PIR, north_bearing: 'NE' })
    api.getPageTitleBlock.mockResolvedValue({ pir_page_id: 'page-1', contract_no: 'HWS0023', date_constructed: '2026-10-05' })
    await renderLoaded()
    expect(await screen.findByText('Contract: HWS0023 · Constructed: 2026-10-05 · ↑ NE')).toBeInTheDocument()
    expect(api.getPageTitleBlock).toHaveBeenCalledWith('page-1')
  })

  it('reads dashes for what is not set', async () => {
    await renderLoaded()
    expect(banner()).toHaveTextContent('Contract: — · Constructed: — · ↑ —')
    expect(screen.getByLabelText('Streets')).toHaveTextContent('Streets: — / — / —')
  })

  it('shows the streets left, frontage, right, a long one cut short', async () => {
    api.getPageTitleBlock.mockResolvedValue({ pir_page_id: 'page-1', cross_street_left: '139 AVENUE',
      frontage_street: 'A VERY LONG BOULEVARD NAME INDEED', cross_street_right: '138 AVENUE' })
    await renderLoaded()
    expect(screen.getByLabelText('Streets')).toHaveTextContent('Streets: 139 AVENUE / A VERY LONG BOULEVA… / 138 AVENUE')
  })

  it('shows saved streets in the banner', async () => {
    api.updatePirTitleBlock.mockResolvedValue({ pir_id: PIR.id, contract_no: null, date_notice_issued: null,
      date_excavated: null, date_constructed: null, north_bearing: null, cross_street_left: null,
      cross_street_right: null, frontage_street: 'MAIN ST', tax_map_width_ft: null, cc_curb_to_curb_ft: null })
    await renderLoaded()
    await userEvent.click(editButton())
    await userEvent.type(within(editor()).getByLabelText(/Frontage street/), 'MAIN ST')
    await userEvent.click(within(editor()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Streets')).toHaveTextContent('Streets: — / MAIN ST / —')
  })

  it('opens the editor seeded with the current values, and a save shows in the banner', async () => {
    api.getPageTitleBlock.mockResolvedValue({ pir_page_id: 'page-1', contract_no: 'HWS2014Q' })
    api.updatePirTitleBlock.mockResolvedValue({ pir_id: PIR.id, contract_no: 'HWS0023', date_notice_issued: null,
      date_excavated: null, date_constructed: '2026-10-05', north_bearing: 'NE' })
    await renderLoaded()
    await userEvent.click(editButton())
    expect(within(editor()).getByLabelText('Contract No.')).toHaveValue('HWS2014Q')
    await userEvent.clear(within(editor()).getByLabelText('Contract No.'))
    await userEvent.type(within(editor()).getByLabelText('Contract No.'), 'HWS0023')
    fireEvent.change(within(editor()).getByLabelText('Date Constructed'), { target: { value: '2026-10-05' } })
    await userEvent.selectOptions(within(editor()).getByLabelText('North Bearing'), 'NE')
    await userEvent.click(within(editor()).getByRole('button', { name: 'Save' }))
    expect(api.updatePirTitleBlock).toHaveBeenCalledWith(PIR.id,
      { contract_no: 'HWS0023', date_constructed: '2026-10-05', north_bearing: 'NE' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(banner()).toHaveTextContent('Contract: HWS0023 · Constructed: 2026-10-05 · ↑ NE')
    expect(await screen.findByText('Title block saved')).toBeInTheDocument()
  })

  it('opens read-only for a demo user, with no Save', async () => {
    await renderLoaded({ user: DEMO_USER })
    await userEvent.click(editButton())
    expect(within(editor()).getByLabelText('Contract No.')).toBeDisabled()
    expect(within(editor()).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('closes and says so when the PIR is gone (404)', async () => {
    api.updatePirTitleBlock.mockRejectedValue(Object.assign(new Error('PIR not found'), { status: 404 }))
    await renderLoaded()
    await userEvent.click(editButton())
    await userEvent.selectOptions(within(editor()).getByLabelText('North Bearing'), 'N')
    await userEvent.click(within(editor()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('PIR not found')
  })

  it('has no title block line without pages', async () => {
    pages = []
    await renderLoaded()
    expect(screen.queryByRole('button', { name: 'Edit title block' })).not.toBeInTheDocument()
    expect(api.getPageTitleBlock).not.toHaveBeenCalled()
  })

  it("says so when the title block can't be read, and the page still works", async () => {
    api.getPageTitleBlock.mockRejectedValue(new Error('Network down'))
    await renderLoaded()
    expect(banner()).toHaveTextContent('Title block not loaded: Network down')
    expect(editButton()).toBeDisabled()
  })
})

describe('PirPage — Pay Items Reported', () => {
  const SUMMARY = [{
    contract_item_id: 'ci-1', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk', unit: 'SF',
    total: 140, idrs: [
      { idr_id: 'idr-2', idr_number: null, report_date: '2026-10-21', status: 'draft', inspector: 'Jane Doe', quantity: 40 },
      { idr_id: 'idr-1', idr_number: 'IDR-001', report_date: '2026-10-19', status: 'approved', inspector: 'Genghis Khan', quantity: 100 },
    ],
  }]

  it('lists each pay item with its total and expands to each IDR, newest first', async () => {
    api.getPropertyPayItemSummary.mockResolvedValue(SUMMARY)
    const user = userEvent.setup()
    renderPage()
    const section = await screen.findByRole('region', { name: 'Pay Items Reported' })
    expect(await within(section).findByText('140 SF')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: '2 IDRs' }))
    const items = within(screen.getByRole('list', { name: 'IDRs reporting 4.13 AAS' })).getAllByRole('listitem')
    expect(items.map(item => item.textContent)).toEqual([
      'Draft · 10/21/26 · 40 SF · Jane Doe(in progress)',
      'IDR-001 · 10/19/26 · 100 SF · Genghis Khan',
    ])
    expect(within(items[1]).getByRole('link', { name: 'IDR-001' })).toHaveAttribute('href', '/project/HWS0023/idr/idr-1')
    expect(api.getPropertyPayItemSummary).toHaveBeenCalledWith(PROPERTY_ID)
  })

  it('counts the IDRs behind each pay item, one IDR in the singular, and folds them away again', async () => {
    const one = { ...SUMMARY[0], contract_item_id: 'ci-2', pay_item_ref: '4.08 AA', total: 40, idrs: [SUMMARY[0].idrs[0]] }
    const three = { ...SUMMARY[0], idrs: [...SUMMARY[0].idrs, { ...SUMMARY[0].idrs[1], idr_id: 'idr-0' }] }
    api.getPropertyPayItemSummary.mockResolvedValue([three, one])
    const user = userEvent.setup()
    renderPage()
    const section = await screen.findByRole('region', { name: 'Pay Items Reported' })
    const button = await within(section).findByRole('button', { name: '3 IDRs' })
    expect(within(section).getByRole('button', { name: '1 IDR' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(screen.getByRole('list', { name: 'IDRs reporting 4.13 AAS' })).getAllByRole('listitem')).toHaveLength(3)
    await user.click(within(section).getByRole('button', { name: 'Hide IDRs' }))
    expect(screen.queryByRole('list', { name: 'IDRs reporting 4.13 AAS' })).not.toBeInTheDocument()
  })

  it('says when no IDR has reported pay items here', async () => {
    renderPage()
    expect(await screen.findByText('No IDR has reported pay items here yet.')).toBeInTheDocument()
  })
})
