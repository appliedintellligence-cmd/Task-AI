import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const legal = fs.readFileSync(new URL('../pages/LegalPage.jsx', import.meta.url), 'utf8')

test('privacy, terms, and support are public routes', () => {
  for (const route of ['/privacy', '/terms', '/support']) assert.match(app, new RegExp(`path="${route}"`))
})

test('privacy policy discloses AI processing and account deletion', () => {
  assert.match(legal, /Google AI, Groq, OpenRouter, and Replicate/)
  assert.match(legal, /permanently delete your account/)
})
