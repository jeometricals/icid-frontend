import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addPayItem, addTruck, approvePayItem, editIdrField, revisePayItem } from '../fieldEdits'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const ITEM_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const EDITED_IDR = { idr_id: IDR_ID, status: 'stage1_review', reports: [], field_edits: [{ edit_id: 'e1' }] }

describe('editIdrField', () => {
  it('PATCHes a report field with its report, its path and the new value, and returns the IDR with its edits', async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    const idr = await editIdrField(IDR_ID, { reportId: REPORT_ID, fieldPath: 'workforce.foremen', newValue: '3' })
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/field`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ report_id: REPORT_ID, field_path: 'workforce.foremen', new_value: '3' })
    expect(idr).toEqual(EDITED_IDR)
  })

  it('sends a header field with no report_id', async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    await editIdrField(IDR_ID, { reportId: null, fieldPath: 'header.weather_am', newValue: 'Rainy' })
    expect(JSON.parse(fetchInit().body)).toEqual({ field_path: 'header.weather_am', new_value: 'Rainy' })
  })

  it.each([[null], [false], [0], ['']])('sends %j as the new value, not as "no value"', async (value) => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    await editIdrField(IDR_ID, { reportId: REPORT_ID, fieldPath: 'safetyChecks.plates', newValue: value })
    const body = JSON.parse(fetchInit().body)
    expect('new_value' in body).toBe(true)
    expect(body.new_value).toBe(value)
  })

  it('carries the status of a lost race, so the page can reload', async () => {
    mockFetch(409, { detail: 'The IDR changed while you were editing; reload and try again' })
    await expect(editIdrField(IDR_ID, { reportId: REPORT_ID, fieldPath: 'description', newValue: 'x' })).rejects.toMatchObject({
      status: 409, message: 'The IDR changed while you were editing; reload and try again',
    })
  })

  it('throws the backend message for a refused edit', async () => {
    mockFetch(403, { detail: 'Only the reviewer who accepted this IDR can edit it' })
    await expect(editIdrField(IDR_ID, { reportId: REPORT_ID, fieldPath: 'description', newValue: 'x' })).rejects.toMatchObject({
      status: 403, message: 'Only the reviewer who accepted this IDR can edit it',
    })
  })
})

describe('revisePayItem', () => {
  it("POSTs the new quantity to the item's own id", async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    const idr = await revisePayItem(IDR_ID, ITEM_ID, '55.00')
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/pay-items/${ITEM_ID}/revise`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ revised_quantity: '55.00' })
    expect(idr).toEqual(EDITED_IDR)
  })

  it('throws with 404 when no report of the IDR holds the item', async () => {
    mockFetch(404, { detail: 'Pay item not found in this IDR' })
    await expect(revisePayItem(IDR_ID, 'gone', '1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('addPayItem', () => {
  it('POSTs the item with the report it joins, in the backend\'s field names', async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    const idr = await addPayItem(IDR_ID, {
      reportId: REPORT_ID, itemNo: '4.05 A', budgetCode: '12345', quantity: '12.50', unit: 'C.Y.', description: 'Concrete base',
    })
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/pay-items/add`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({
      report_id: REPORT_ID, item_no: '4.05 A', budget_code: '12345', quantity: '12.50', unit: 'C.Y.',
      description: 'Concrete base',
    })
    expect(idr).toEqual(EDITED_IDR)
  })

  it('throws the backend message when the report takes no pay items', async () => {
    mockFetch(400, { detail: 'This kind of report has no pay items' })
    await expect(addPayItem(IDR_ID, { reportId: REPORT_ID, itemNo: 'x', quantity: '1' })).rejects.toMatchObject({
      status: 400, message: 'This kind of report has no pay items',
    })
  })
})

describe('addTruck', () => {
  const TRUCK = {
    truckOrTicketNo: 'T-103', inspectionSticker: 'NA', loadSizeCy: '', endBatch: '', mixingRevs: '', startDischTime: '',
    endDischTime: '', slump: '4.5', airContent: '', concTemp: '', cylinderNumbers: '',
  }

  it('POSTs the truck, in the keys the report stores, to the report it joins', async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    const idr = await addTruck(IDR_ID, REPORT_ID, TRUCK)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/reports/${REPORT_ID}/trucks/add`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(TRUCK)
    expect(idr).toEqual(EDITED_IDR)
  })

  it('throws the backend message when the truck has neither a number nor a slump', async () => {
    mockFetch(400, { detail: 'A truck needs a truck or ticket number or a slump' })
    await expect(addTruck(IDR_ID, REPORT_ID, { ...TRUCK, truckOrTicketNo: '', slump: '' })).rejects.toMatchObject({
      status: 400, message: 'A truck needs a truck or ticket number or a slump',
    })
  })
})

describe('approvePayItem', () => {
  it('POSTs to the item\'s approve route with no body and returns the IDR with its edits', async () => {
    mockFetch(200, { status: 'success', data: EDITED_IDR })
    const idr = await approvePayItem(IDR_ID, ITEM_ID)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/pay-items/${ITEM_ID}/approve`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeUndefined()
    expect(idr).toEqual(EDITED_IDR)
  })

  it('throws the backend message when the item can\'t be found', async () => {
    mockFetch(404, { detail: 'Pay item not found in this IDR' })
    await expect(approvePayItem(IDR_ID, ITEM_ID)).rejects.toMatchObject({ status: 404, message: 'Pay item not found in this IDR' })
  })
})
