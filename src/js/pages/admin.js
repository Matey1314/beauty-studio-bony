import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize admin dashboard
 * Load and display content based on user role
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      console.error('No active session. User should have been redirected.');
      window.location.href = 'login.html';
      return;
    }

    await initializeDashboard(session);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
});

/**
 * Initialize the dashboard based on user role
 * @param {Object} session - The auth session object
 */
async function initializeDashboard(session) {
  try {
    const userRole = await getUserRole(session.user.id);

    if (!userRole) {
      console.error('Unable to determine user role');
      return;
    }

    // Get section elements
    const manageServicesSection = document.getElementById('manageServicesSection');
    const manageUsersSection = document.getElementById('manageUsersSection');
    const myScheduleSection = document.getElementById('myScheduleSection');

    if (userRole === 'admin') {
      // Admin: Show all sections
      if (manageServicesSection) manageServicesSection.classList.remove('d-none');
      if (manageUsersSection) manageUsersSection.classList.remove('d-none');
      if (myScheduleSection) myScheduleSection.classList.remove('d-none');

      // Load content for admin
      await loadAdminSchedule(session.user.id);
    } else if (userRole === 'staff') {
      // Staff: Hide Manage Services and Manage Users, show only My Schedule
      if (manageServicesSection) manageServicesSection.classList.add('d-none');
      if (manageUsersSection) manageUsersSection.classList.add('d-none');
      if (myScheduleSection) myScheduleSection.classList.remove('d-none');

      // Load content for staff (their own schedule)
      await loadStaffSchedule(session.user.id);
    } else {
      // Client or other role: Should not be here
      console.warn('User role does not have dashboard access');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
}

/**
 * Get user role from profiles table
 * @param {string} userId - The user ID
 * @returns {Promise<string|null>} The user's role or null
 */
async function getUserRole(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data?.role || null;
  } catch (error) {
    console.error('Unexpected error fetching user role:', error);
    return null;
  }
}

/**
 * Load and display schedule for admin users
 * Shows all bookings in the system
 * @param {string} userId - The admin user ID
 */
async function loadAdminSchedule(userId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        client_id,
        service_id,
        appointment_date,
        status,
        employee_id,
        profiles:client_id(full_name, phone),
        services:service_id(name, price, duration_minutes)
      `)
      .order('appointment_date', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    displaySchedule(data, 'Admin Schedule');
  } catch (error) {
    console.error('Unexpected error loading admin schedule:', error);
  }
}

/**
 * Load and display schedule for staff users
 * Shows only bookings assigned to the staff member
 * @param {string} userId - The staff member's user ID
 */
async function loadStaffSchedule(userId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        client_id,
        service_id,
        appointment_date,
        status,
        employee_id,
        profiles:client_id(full_name, phone),
        services:service_id(name, price, duration_minutes)
      `)
      .eq('employee_id', userId)
      .order('appointment_date', { ascending: true });

    if (error) {
      console.error('Error fetching staff bookings:', error);
      return;
    }

    displaySchedule(data, 'Your Schedule');
  } catch (error) {
    console.error('Unexpected error loading staff schedule:', error);
  }
}

/**
 * Display bookings in a table format
 * @param {Array} bookings - Array of booking objects
 * @param {string} title - Title for the schedule display
 */
function displaySchedule(bookings, title) {
  const scheduleContent = document.getElementById('scheduleContent');

  if (!scheduleContent) {
    console.error('Schedule content container not found');
    return;
  }

  if (!bookings || bookings.length === 0) {
    scheduleContent.innerHTML = '<p class="text-muted">No bookings found.</p>';
    return;
  }

  // Create table HTML
  const tableHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>Date & Time</th>
            <th>Client Name</th>
            <th>Phone</th>
            <th>Service</th>
            <th>Price</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${bookings.map(booking => `
            <tr>
              <td>${new Date(booking.appointment_date).toLocaleString()}</td>
              <td>${booking.profiles?.full_name || 'N/A'}</td>
              <td>${booking.profiles?.phone || 'N/A'}</td>
              <td>${booking.services?.name || 'N/A'}</td>
              <td>$${booking.services?.price || 'N/A'}</td>
              <td>${booking.services?.duration_minutes || 'N/A'} min</td>
              <td>
                <span class="badge bg-${getStatusBadgeColor(booking.status)}">
                  ${booking.status}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  scheduleContent.innerHTML = tableHTML;
}

/**
 * Get Bootstrap badge color based on booking status
 * @param {string} status - The booking status
 * @returns {string} Bootstrap color class
 */
function getStatusBadgeColor(status) {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'warning';
    case 'confirmed':
      return 'success';
    case 'completed':
      return 'info';
    case 'cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
}
