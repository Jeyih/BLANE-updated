/* ============================================================
   BLANE — Admin Access Control
   Replaces: the ADMIN_EMAILS array + guardAdmin() logic in
   js/admin-auth.js.

   Must match the email list in supabase/admin_schema.sql
   (is_admin() function) so frontend and database RLS agree.
   ============================================================ */

export const ADMIN_EMAILS = [
  'Jelaxamana008@gmail.com',
  'youradmin@gmail.com',
  // add more admin emails here
];

export function isAdmin(user) {
  if (!user?.email) return false;
  const email = user.email.toLowerCase();
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
}