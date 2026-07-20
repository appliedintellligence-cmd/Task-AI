import test from 'node:test';import assert from 'node:assert/strict';import {PUBLIC_ROUTES,PROTECTED_ROUTES,isProtectedRoute} from './routePolicy.js'
test('landing and login are public while product routes remain protected',()=>{assert.deepEqual(PUBLIC_ROUTES,['/','/login']);for(const route of PROTECTED_ROUTES)assert.equal(isProtectedRoute(route),true);assert.equal(isProtectedRoute('/'),false)})
