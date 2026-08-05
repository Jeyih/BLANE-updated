export const ADMIN_EMAILS = [
  'Jelaxamana008@gmail.com',
  'Sample@admin.com',
  // add more admin emails here
];

export function isAdmin(user) {
  if (!user?.email) return false;
  const email = user.email.toLowerCase();
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
}