import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const legal = fs.readFileSync(new URL('../pages/LegalPage.jsx', import.meta.url), 'utf8')
const vercel = fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')

test('privacy, terms, and support are public routes with direct Vercel navigation', () => {
  for (const route of ['/privacy', '/terms', '/support']) {
    assert.match(app, new RegExp(`path="${route}"`))
    assert.match(vercel, new RegExp(`"source": "${route}"`))
  }
})

test('privacy policy discloses AI processing and account deletion', () => {
  assert.match(legal, /Google AI, Groq, OpenRouter, and Replicate/)
  assert.match(legal, /permanently delete your account/)
})
