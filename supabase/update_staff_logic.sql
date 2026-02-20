-- ============================================================================
-- Database Updates for Staff Role Implementation
-- ============================================================================
-- This script:
-- 1. Adds employee_id column to bookings table
-- 2. Updates RLS policies to support staff members managing their own bookings
-- 3. Maintains admin access to all bookings

-- ============================================================================
-- ALTER BOOKINGS TABLE
-- ============================================================================

-- Add employee_id column to bookings table
-- References profiles(id) for staff member assignment
-- ON DELETE SET NULL allows deletion of staff without losing booking history
ALTER TABLE bookings
ADD COLUMN employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- DROP OLD BOOKINGS POLICIES (to avoid conflicts)
-- ============================================================================

DROP POLICY IF EXISTS "Users can select their own bookings, admins select all" ON bookings;
DROP POLICY IF EXISTS "Users can insert their own bookings, admins can insert any" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings, admins can update any" ON bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings, admins can delete any" ON bookings;

-- ============================================================================
-- NEW BOOKINGS TABLE POLICIES (with Staff Support)
-- ============================================================================

-- Policy: SELECT for bookings
-- Clients can view their own bookings
-- Staff can view bookings assigned to them
-- Admins can view all bookings
CREATE POLICY "Select bookings based on role"
  ON bookings FOR SELECT
  USING (
    -- Client: can see their own bookings
    auth.uid() = client_id
    OR
    -- Staff: can see bookings assigned to them
    (
      auth.uid() = employee_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'staff'
      )
    )
    OR
    -- Admin: can see all bookings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: INSERT for bookings
-- Clients can insert their own bookings
-- Admins can insert bookings for any client
CREATE POLICY "Insert bookings based on role"
  ON bookings FOR INSERT
  WITH CHECK (
    -- Client: can only insert for themselves
    auth.uid() = client_id
    OR
    -- Admin: can insert for any client
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: UPDATE for bookings
-- Clients can update their own bookings
-- Staff can update bookings assigned to them
-- Admins can update any booking
CREATE POLICY "Update bookings based on role"
  ON bookings FOR UPDATE
  USING (
    -- Client: can update their own bookings
    auth.uid() = client_id
    OR
    -- Staff: can update bookings assigned to them
    (
      auth.uid() = employee_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'staff'
      )
    )
    OR
    -- Admin: can update any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- Client: can only update their own bookings
    auth.uid() = client_id
    OR
    -- Staff: can only update bookings assigned to them
    (
      auth.uid() = employee_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'staff'
      )
    )
    OR
    -- Admin: can update any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: DELETE for bookings
-- Clients can delete their own bookings
-- Staff can delete bookings assigned to them
-- Admins can delete any booking
CREATE POLICY "Delete bookings based on role"
  ON bookings FOR DELETE
  USING (
    -- Client: can delete their own bookings
    auth.uid() = client_id
    OR
    -- Staff: can delete bookings assigned to them
    (
      auth.uid() = employee_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'staff'
      )
    )
    OR
    -- Admin: can delete any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
