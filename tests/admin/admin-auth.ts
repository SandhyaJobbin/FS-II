/**
 * admin-auth.ts
 *
 * Node-importable mirror of the admin auth logic extracted from backend/Code.gs.
 * Code.gs is Google Apps Script (not Node-importable), so this mirror allows
 * vitest to test the real extracted auth logic without GAS dependencies.
 */

export const ADMIN_TOKEN = "FS_RECRUITER_SECRET_2026";

/**
 * checkAdminAuth — mirrors the function extracted from Code.gs.
 * Validates that the provided token matches the admin token.
 */
export function checkAdminAuth(token: string): boolean {
  return token === ADMIN_TOKEN;
}
