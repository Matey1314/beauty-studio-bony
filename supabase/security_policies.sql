-- ============================================================================
-- Row Level Security (RLS) Policies for Beauty Studio Bony
-- ============================================================================
-- This script enables RLS on profiles, services, and bookings tables
-- and creates policies based on user roles defined in the profiles table.

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own profile
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
  );

-- Policy: Admins can SELECT all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can UPDATE their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id
  )
  WITH CHECK (
    auth.uid() = id
  );

-- Policy: Admins can UPDATE all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- SERVICES TABLE POLICIES
-- ============================================================================

-- Enable RLS on services table
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone (including unauthenticated users) can SELECT services
CREATE POLICY "Anyone can read services"
  ON services FOR SELECT
  USING (true);

-- Policy: Only admins can INSERT services
CREATE POLICY "Only admins can insert services"
  ON services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can UPDATE services
CREATE POLICY "Only admins can update services"
  ON services FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Only admins can DELETE services
CREATE POLICY "Only admins can delete services"
  ON services FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- BOOKINGS TABLE POLICIES
-- ============================================================================

-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT only their own bookings
-- Admins can SELECT all bookings
CREATE POLICY "Users can select their own bookings, admins select all"
  ON bookings FOR SELECT
  USING (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can INSERT only their own bookings
-- Admins can INSERT bookings for any client
CREATE POLICY "Users can insert their own bookings, admins can insert any"
  ON bookings FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can UPDATE only their own bookings
-- Admins can UPDATE any booking
CREATE POLICY "Users can update their own bookings, admins can update any"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can DELETE only their own bookings
-- Admins can DELETE any booking
CREATE POLICY "Users can delete their own bookings, admins can delete any"
  ON bookings FOR DELETE
  USING (
    auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
