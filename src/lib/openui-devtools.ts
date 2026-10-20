/**
 * Vite aliases the SDK's development-only devtools import here. The upstream
 * auto-mounted inspector downloads executable code from a CDN; this loopback
 * demo intentionally uses only locally installed UI code. No production API.
 */
export function OpenUIDevtools() { return null; }
