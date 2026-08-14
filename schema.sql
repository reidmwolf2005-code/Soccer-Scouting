-- MIAC Soccer Scouting Hub — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- After running, enable Row Level Security on each table in the Table Editor,
-- then the policies below will take effect.

-- ─── 1. user_profiles ────────────────────────────────────────────────────────
-- Extends auth.users with display name and role.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  role        TEXT        NOT NULL DEFAULT 'player'
                          CHECK (role IN ('player', 'coach', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read all profiles (needed for Admin page user list).
CREATE POLICY "profiles_select_all"  ON public.user_profiles FOR SELECT USING (TRUE);
-- Users can update their own name (not role).
CREATE POLICY "profiles_update_self" ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()));
-- Admins can update any profile (incl. role changes).
CREATE POLICY "profiles_update_admin" ON public.user_profiles FOR UPDATE
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');
-- Admins can delete profiles.
CREATE POLICY "profiles_delete_admin" ON public.user_profiles FOR DELETE
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- Auto-create a profile row when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'player')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. team_overrides ───────────────────────────────────────────────────────
-- Coach-edited scouting model per opponent team (replaces localStorage miac_model_<ABBR>).
-- One row per team abbr; coaches share a single authoritative model per team.
CREATE TABLE IF NOT EXISTS public.team_overrides (
  abbr        TEXT        PRIMARY KEY,   -- e.g. 'OLE', 'SJU'
  model       JSONB       NOT NULL,      -- full model object (roster, xi, results, tactical, lastStats, formation)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES auth.users(id)
);

ALTER TABLE public.team_overrides ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read overrides (players can view scouting reports).
CREATE POLICY "overrides_select" ON public.team_overrides FOR SELECT TO authenticated USING (TRUE);
-- Coaches and admins can upsert.
CREATE POLICY "overrides_upsert" ON public.team_overrides FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('coach', 'admin'));
CREATE POLICY "overrides_update" ON public.team_overrides FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('coach', 'admin'));
-- Admins can delete overrides.
CREATE POLICY "overrides_delete" ON public.team_overrides FOR DELETE TO authenticated
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- ─── 3. schedule ─────────────────────────────────────────────────────────────
-- Gustavus season schedule (replaces localStorage miac_schedule).
-- Single row; coaches replace the whole array.
CREATE TABLE IF NOT EXISTS public.schedule (
  id          SERIAL      PRIMARY KEY,
  games       JSONB       NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES auth.users(id)
);

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read.
CREATE POLICY "schedule_select" ON public.schedule FOR SELECT TO authenticated USING (TRUE);
-- Coaches and admins can upsert row id=1.
CREATE POLICY "schedule_upsert" ON public.schedule FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('coach', 'admin'));
CREATE POLICY "schedule_update" ON public.schedule FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('coach', 'admin'));

-- Seed the single schedule row (coaches will overwrite the games array).
INSERT INTO public.schedule (id, games) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;

-- ─── 4. reports ──────────────────────────────────────────────────────────────
-- Saved scouting reports — frozen snapshots (replaces localStorage miac_reports).
CREATE TABLE IF NOT EXISTS public.reports (
  id          TEXT        PRIMARY KEY,   -- 'r_<timestamp><random>' from addReport()
  data        JSONB       NOT NULL,      -- full report object at save time (immutable snapshot)
  created_by  UUID        REFERENCES auth.users(id),
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read reports.
CREATE POLICY "reports_select" ON public.reports FOR SELECT TO authenticated USING (TRUE);
-- Coaches and admins can create reports.
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('coach', 'admin'));
-- Report author or admin can delete.
CREATE POLICY "reports_delete" ON public.reports FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );
