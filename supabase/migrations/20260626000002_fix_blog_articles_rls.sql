-- Fix RLS policies on blog_articles to explicitly allow SELECT for published articles.
-- The issue: the "admins_manage_articles" policy with cmd="ALL" was preventing
-- public users from reading published articles. We need explicit SELECT policies.

-- Drop the problematic all-in-one admin policy
DROP POLICY IF EXISTS "admins_manage_articles" ON blog_articles;

-- Ensure the public SELECT policy is properly configured
DROP POLICY IF EXISTS "published_articles_are_public" ON blog_articles;
CREATE POLICY "published_articles_are_public"
  ON blog_articles
  FOR SELECT
  USING (is_published = true);

-- Create separate policies for admin SELECT
CREATE POLICY "admin_select_all_articles"
  ON blog_articles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin INSERT policy
CREATE POLICY "admin_insert_articles"
  ON blog_articles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin UPDATE policy
CREATE POLICY "admin_update_articles"
  ON blog_articles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin DELETE policy
CREATE POLICY "admin_delete_articles"
  ON blog_articles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
