import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

let server
let MatterPrintReport
const timestamp = '2026-09-20T10:00:00.000Z'

before(async () => {
  // Vite transforms the real JSX and CSS modules. No browser or extra test library.
  server = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const module = await server.ssrLoadModule('/src/features/matters/components/MatterPrintReport.jsx')
  MatterPrintReport = module.default
})

after(async () => { await server?.close() })

function render(overrides = {}) {
  const document = {
    id: 'passport', name: 'Passport', description: 'A clear copy',
    isKey: true, status: 'Received', expectedQuantity: 10, receivedQuantity: 6,
    sectionId: 'petitioner', comment: 'Six copies received', updatedBy: 'Alex', updatedAt: timestamp,
  }
  return renderToStaticMarkup(createElement(MatterPrintReport, {
    matterNumber: '001234', matterTypeName: 'Family Petition', status: 'Accepted',
    statusMode: 'Manual', statusUpdatedAt: timestamp, printedAt: timestamp,
    documents: [document, { ...document, id: 'letters', name: 'Letters', sectionId: 'beneficiary', status: 'Pending' }],
    sections: [{ id: 'petitioner', name: 'Petitioner' }, { id: 'beneficiary', name: 'Beneficiary' }],
    previousDocuments: [], hasUnsavedChanges: false,
    ...overrides,
  }))
}

test('report renders every section, status, quantity and comment without interactive controls', () => {
  const html = render()
  for (const expected of ['Matter 001234', 'Family Petition', 'Accepted', 'Manual', 'Petitioner', 'Beneficiary', 'Passport', 'Letters', '6 of 10', 'Six copies received']) {
    assert.ok(html.includes(expected), expected)
  }
  assert.match(html, /<dt>Received<\/dt><dd>1<\/dd>/)
  assert.match(html, /<dt>Pending<\/dt><dd>1<\/dd>/)
  assert.doesNotMatch(html, /<(button|input|select|textarea|nav)\b/)
  assert.doesNotMatch(html, /Unsaved changes included/)
})

test('report includes current unsaved data and safely renders comments as plain text', () => {
  const comment = '<script>alert("test")</script>\nSecond line'
  const html = render({
    hasUnsavedChanges: true,
    documents: [{ id: 'current', name: 'Current local document', isKey: false, status: 'Client Does Not Have', expectedQuantity: null, receivedQuantity: 6, comment, updatedBy: 'Alex', updatedAt: timestamp }],
  })
  assert.match(html, /Unsaved changes included/)
  assert.match(html, /Current local document/)
  assert.match(html, /6 previously recorded; not counted/)
  assert.match(html, /<dt>Received<\/dt><dd>0<\/dd>/)
  assert.match(html, /<dt>Client Does Not Have<\/dt><dd>1<\/dd>/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('archive prints separately and does not inflate active counts', () => {
  const html = render({ previousDocuments: [{
    id: 'archived', name: 'Former requirement', status: 'Received', isKey: true,
    expectedQuantity: null, receivedQuantity: null, comment: 'Retained comment',
    updatedBy: 'Alex', updatedAt: timestamp, removedAt: timestamp, previousSectionName: 'Former section',
  }] })
  assert.match(html, /Previous requirements/)
  assert.match(html, /Former requirement/)
  assert.match(html, /Former section/)
  assert.match(html, /Retained comment/)
  assert.match(html, /<dt>Received<\/dt><dd>1<\/dd>/)
  assert.match(html, /Active requirements · 2 documents/)
})

test('empty reports remain printable without invented documents or totals', () => {
  const html = render({ documents: [], sections: [] })
  assert.match(html, /No active requirements/)
  assert.match(html, /Active requirements · 0 documents/)
  assert.match(html, /<dt>Received<\/dt><dd>0<\/dd>/)
})
