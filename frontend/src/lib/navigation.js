export const WEB_NAVIGATION = Object.freeze([
  { label: 'Home', path: '/app', icon: 'home' },
  { label: 'New diagnosis', path: '/diagnose', icon: 'camera' },
  { label: 'My repairs', path: '/repairs', icon: 'repairs' },
  { label: 'Shopping lists', path: '/lists', icon: 'list' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
])

export const MOBILE_NAVIGATION = Object.freeze([
  { label: 'Home', route: 'home' },
  { label: 'Repairs', route: 'repairs' },
  { label: 'Scan', route: 'index', prominent: true },
  { label: 'Lists', route: 'lists' },
  { label: 'Profile', route: 'profile' },
])
