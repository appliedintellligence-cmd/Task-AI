export const PUBLIC_ROUTES = Object.freeze(['/', '/login', '/reset-password'])
export const PROTECTED_ROUTES = Object.freeze(['/app','/diagnose','/repairs','/lists','/settings','/results','/guided'])
export const isProtectedRoute = (path) => PROTECTED_ROUTES.includes(path)
