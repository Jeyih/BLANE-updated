import { supabase } from './supabase';

export async function isAdmin(user) {
  if (!user?.id) return false;

  const { data, error } = await supabase.rpc('blane_is_admin');
  if (error) throw error;

  return data === true;
}
