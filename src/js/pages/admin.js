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
    const adminServicesSection = document.getElementById('adminServicesSection');
    const manageUsersSection = document.getElementById('manageUsersSection');
    const myScheduleSection = document.getElementById('myScheduleSection');

    if (userRole === 'admin') {
      // Admin: Show all sections
      if (adminServicesSection) adminServicesSection.classList.remove('d-none');
      if (manageUsersSection) manageUsersSection.classList.remove('d-none');
      if (myScheduleSection) myScheduleSection.classList.remove('d-none');

      // Load content for admin
      await loadSpecialists();
      await loadServices();
      await loadAdminSchedule(session.user.id);
      setupServiceFormListener();
    } else if (userRole === 'staff') {
      // Staff: Hide Manage Services and Manage Users, show only My Schedule
      if (adminServicesSection) adminServicesSection.classList.add('d-none');
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
 * Load specialists from the database and populate the specialist dropdown
 */
async function loadSpecialists() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'staff')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching specialists:', error);
      return;
    }

    const specialistSelect = document.getElementById('serviceSpecialist');
    if (!specialistSelect) {
      console.error('Specialist select element not found');
      return;
    }

    // Clear existing options except the default one
    specialistSelect.innerHTML = '<option value="">Select Specialist...</option>';

    // Add specialists to dropdown
    if (data && data.length > 0) {
      data.forEach(specialist => {
        const option = document.createElement('option');
        option.value = specialist.id;
        option.textContent = specialist.full_name;
        specialistSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Unexpected error loading specialists:', error);
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

/**
 * Load services from the database and populate the table
 */
async function loadServices() {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*, profiles(full_name)');

    console.log('Fetched services:', services);
    console.error('Fetch error:', error);

    if (error) {
      console.error('Error fetching services:', error);
      return;
    }

    populateServicesTable(services || []);
  } catch (error) {
    console.error('Unexpected error loading services:', error);
  }
}

/**
 * Populate the services table with data
 * @param {Array} services - Array of service objects
 */
function populateServicesTable(services) {
  const tbody = document.getElementById('servicesTableBody');

  if (!tbody) {
    console.error('Services table body not found');
    return;
  }

  tbody.innerHTML = '';

  if (services.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No services found.</td></tr>';
    return;
  }

  services.forEach(service => {
    const specialistName = (service.profiles && service.profiles.full_name) ? service.profiles.full_name : 'Без специалист';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${service.name}</td>
      <td>${service.description}</td>
      <td>$${parseFloat(service.price).toFixed(2)}</td>
      <td>${service.duration_minutes} min</td>
      <td>${specialistName}</td>
      <td>
        <button class="btn btn-sm btn-danger delete-service-btn" data-service-id="${service.id}">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-service-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serviceId = e.target.getAttribute('data-service-id');
      await deleteService(serviceId);
    });
  });
}

/**
 * Setup event listener for the Add Service form
 */
function setupServiceFormListener() {
  const form = document.getElementById('addServiceForm');

  if (!form) {
    console.error('Add Service form not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('serviceName').value.trim();
    const description = document.getElementById('serviceDescription').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value);
    const duration_minutes = parseInt(document.getElementById('serviceDuration').value);
    const specialist_id = document.getElementById('serviceSpecialist').value.trim() || null;

    if (!name || !description || isNaN(price) || isNaN(duration_minutes)) {
      alert('Please fill in all required fields correctly');
      return;
    }

    try {
      const { error } = await supabase
        .from('services')
        .insert([
          {
            name,
            description,
            price,
            duration_minutes,
            specialist_id
          }
        ]);

      if (error) {
        console.error('Error adding service:', error);
        alert('Failed to add service');
        return;
      }

      // Clear the form
      form.reset();

      // Reload services
      await loadServices();
      alert('Service added successfully!');
    } catch (error) {
      console.error('Unexpected error adding service:', error);
      alert('An error occurred while adding the service');
    }
  });
}

/**
 * Delete a service by ID
 * @param {string} serviceId - The service ID to delete
 */
async function deleteService(serviceId) {
  if (!confirm('Are you sure you want to delete this service?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
      return;
    }

    // Reload services
    await loadServices();
    alert('Service deleted successfully!');
  } catch (error) {
    console.error('Unexpected error deleting service:', error);
    alert('An error occurred while deleting the service');
  }
}
