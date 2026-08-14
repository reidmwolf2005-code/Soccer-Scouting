// MIAC scouting — auth layer backed by Supabase.
// Function signatures match the original prototype — bodies now call Supabase.
// All functions that previously used localStorage are now async.

import { supabase } from './supabase-client.js';

export const ROLES = ['player', 'coach', 'admin'];
export const ROLE_LABEL = { player: 'Player', coach: 'Coach', admin: 'Admin' };

// ─── Session helpers ──────────────────────────────────────────────────────────

// Returns the Supabase session (or null if signed out).
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Sign in with email + password (for the login page / modal).
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// Sign in via OAuth (e.g. Google SSO for .edu accounts).
// provider: 'google' | 'azure' | 'github' — configure the provider in Supabase Dashboard first.
export async function signInWithSSO(provider = 'google') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Listen for auth state changes; callback receives (event, session).
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ─── User / profile API ───────────────────────────────────────────────────────

export async function getUsers() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name, role, created_at');
  if (error) { console.error('getUsers', error); return []; }
  // Attach email from auth.users via Supabase admin API (only works server-side).
  // On the client, email is available only for the signed-in user.
  return (data || []).map(u => ({ ...u, email: '' }));
}

// Users self-register via the Login page signup tab (gustavus.edu only).
// Admins use this only to update an existing user's role — not to create accounts.
export async function addUser({ name, email, role }) {
  if (!email || !email.toLowerCase().endsWith('@gustavus.edu'))
    throw new Error('Only @gustavus.edu email addresses are allowed.');
  role = ROLES.includes(role) ? role : 'player';
  // Update the profile row if the user already exists (e.g. to set their name/role before they log in).
  const { error } = await supabase.from('user_profiles').update({ name, role }).eq('email', email);
  if (error) throw new Error(error.message);
  return getUsers();
}

export async function removeUser(id) {
  // Deleting from user_profiles cascades because of ON DELETE CASCADE on auth.users.
  // Actual auth.users deletion requires the admin API (call via Edge Function).
  const { error } = await supabase.functions.invoke('delete-user', { body: { userId: id } });
  if (error) console.error('removeUser', error);
  return getUsers();
}

export async function setRole(id, role) {
  if (!ROLES.includes(role)) return getUsers();
  const { error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('id', id);
  if (error) console.error('setRole', error);
  return getUsers();
}

// ─── Current user ─────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { name: 'Guest', email: '', role: 'player' };
  const { data } = await supabase
    .from('user_profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    name: data?.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: data?.role || 'player',
  };
}

export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// setCurrentUser is no longer needed — Supabase manages the session.
// Kept as a no-op so any callers don't break.
export function setCurrentUser(_id) {}

export async function canEdit() {
  const u = await getCurrentUser();
  return u.role === 'coach' || u.role === 'admin';
}

export async function isAdmin() {
  const u = await getCurrentUser();
  return u.role === 'admin';
}

// ─── Display helpers — sync, unchanged ───────────────────────────────────────

export function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function roleColor(role) {
  return role === 'admin' ? { bg: 'rgba(198,160,74,.18)', fg: '#e4c977' }
    : role === 'coach' ? { bg: 'rgba(95,191,122,.18)', fg: '#5fbf7a' }
    : { bg: 'rgba(255,255,255,.1)', fg: '#b8b8ba' };
}
