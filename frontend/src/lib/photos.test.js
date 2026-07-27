import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshRepairPhoto } from './photos.js'

test('signed repair photo refresh is owner-authenticated and job-scoped', async () => {
  let call
  const result = await refreshRepairPhoto({
    apiUrl: 'https://api.example', jobId: 'job/a', token: 'owner-token',
    fetcher: async (...args) => { call = args; return { image_url: 'https://signed.example/new', legacy: false } },
  })
  assert.equal(call[0], 'https://api.example/jobs/job%2Fa/photo-url')
  assert.equal(call[1].headers.Authorization, 'Bearer owner-token')
  assert.equal(result.image_url, 'https://signed.example/new')
})

test('photo refresh rejects missing ownership context', async () => {
  await assert.rejects(() => refreshRepairPhoto({ apiUrl: 'x', jobId: '', token: 'token' }))
})
