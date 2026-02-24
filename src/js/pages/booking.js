import { supabase } from '../services/supabaseClient.js';

/**
 * Check for active session and redirect to login if necessary
 */
async function checkSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error checking session:', error);
    window.location.href = 'login.html';
    return null;
  }
}

/**
 * Initialize booking page
 * Load services and staff members
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await checkSession();
    if (!session) return;

    await loadFormOptions();
    setupFormSubmission();
  } catch (error) {
    console.error('Error initializing booking page:', error);
    showBookingMessage('Error loading booking form. Please refresh the page.', 'danger');
  }
});

/**
 * Load form options (services and specialists)
 */
async function loadFormOptions() {
  try {
    await loadServices();
    await loadSpecialists();
  } catch (error) {
    console.error('Error loading form options:', error);
    showBookingMessage('Error loading form options. Please refresh the page.', 'danger');
  }
}

/**
 * Load all services from the database and populate the service dropdown
 */
async function loadServices() {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching services:', error);
      showBookingMessage('Error loading services. Please try again.', 'danger');
      return;
    }

    const serviceSelect = document.getElementById('bookingService');
    if (!serviceSelect) return;

    // Clear existing options except the first placeholder
    serviceSelect.innerHTML = '<option value="">Select Service...</option>';

    // Add service options
    if (data && data.length > 0) {
      data.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.name} - $${service.price} (${service.duration_minutes} min)`;
        serviceSelect.appendChild(option);
      });
    } else {
      serviceSelect.innerHTML = '<option value="">No services available</option>';
      serviceSelect.disabled = true;
    }
  } catch (error) {
    console.error('Unexpected error loading services:', error);
    showBookingMessage('An unexpected error occurred. Please try again.', 'danger');
  }
}

/**
 * Load all staff members from the database and populate the specialist dropdown
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
      showBookingMessage('Error loading specialists. Please try again.', 'danger');
      return;
    }

    const specialistSelect = document.getElementById('bookingSpecialist');
    if (!specialistSelect) return;

    // Clear existing options except the first placeholder
    specialistSelect.innerHTML = '<option value="">Select Specialist...</option>';

    // Add specialist options
    if (data && data.length > 0) {
      data.forEach(specialist => {
        const option = document.createElement('option');
        option.value = specialist.id;
        option.textContent = specialist.full_name || 'Unknown Specialist';
        specialistSelect.appendChild(option);
      });
    } else {
      specialistSelect.innerHTML = '<option value="">No specialists available</option>';
      specialistSelect.disabled = true;
    }
  } catch (error) {
    console.error('Unexpected error loading specialists:', error);
    showBookingMessage('An unexpected error occurred. Please try again.', 'danger');
  }
}

/**
 * Setup form submission handler
 */
function setupFormSubmission() {
  const bookingForm = document.getElementById('bookingForm');

  if (!bookingForm) {
    console.error('Booking form not found');
    return;
  }

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitBooking();
  });
}

/**
 * Submit booking to the database
 */
async function submitBooking() {
  try {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      showBookingMessage('Please log in to book an appointment.', 'danger');
      window.location.href = 'login.html';
      return;
    }

    // Get form values
    const serviceVal = document.getElementById('bookingService').value;
    const specialistVal = document.getElementById('bookingSpecialist').value;
    const dateVal = document.getElementById('bookingDate').value;
    const timeVal = document.getElementById('bookingTime').value;

    // Validate inputs
    if (!serviceVal || !specialistVal || !dateVal || !timeVal) {
      showBookingMessage('Please fill in all required fields.', 'warning');
      return;
    }

    // Disable form during submission
    const submitButton = document.querySelector('#bookingForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Confirming...';
    }

    // Combine date and time into a valid PostgreSQL timestamp
    const appointmentDate = new Date(`${dateVal}T${timeVal}`).toISOString();

    // Create booking object
    const booking = {
      client_id: session.user.id,
      service_id: serviceVal,
      employee_id: specialistVal,
      appointment_date: appointmentDate,
      status: 'pending'
    };

    // Insert booking into database
    const { data, error } = await supabase
      .from('bookings')
      .insert([booking])
      .select();

    if (error) {
      console.error('Error creating booking:', error);
      showBookingMessage(`Error booking appointment: ${error.message}`, 'danger');
      
      // Re-enable form button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Confirm Booking';
      }
      return;
    }

    showBookingMessage('Booking confirmed! Redirecting to your profile...', 'success');

    // Reset form
    document.getElementById('bookingForm').reset();

    // Re-enable form button
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Confirm Booking';
    }

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 2000);
  } catch (error) {
    console.error('Unexpected error submitting booking:', error);
    showBookingMessage(`An unexpected error occurred: ${error.message}`, 'danger');

    // Re-enable form button
    const submitButton = document.querySelector('#bookingForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Confirm Booking';
    }
  }
}

/**
 * Display booking message to user
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showBookingMessage(message, type = 'info') {
  const messageDiv = document.getElementById('bookingMessage');

  if (!messageDiv) return;

  messageDiv.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  // Auto-dismiss success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      const alert = messageDiv.querySelector('.alert');
      if (alert) {
        alert.remove();
      }
    }, 3000);
  }
}

