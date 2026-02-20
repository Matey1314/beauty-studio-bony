import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize booking page
 * Load services and staff members
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadServices();
    await loadSpecialists();
    setupFormSubmission();
  } catch (error) {
    console.error('Error initializing booking page:', error);
    showStatusMessage('Error loading booking form. Please refresh the page.', 'danger');
  }
});

/**
 * Load all services from the database
 * Populate the service dropdown
 */
async function loadServices() {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching services:', error);
      showStatusMessage('Error loading services. Please try again.', 'danger');
      return;
    }

    const serviceSelect = document.getElementById('serviceSelect');
    if (!serviceSelect) return;

    // Clear existing options except the first placeholder
    serviceSelect.innerHTML = '<option value="">Choose a service...</option>';

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
    showStatusMessage('An unexpected error occurred. Please try again.', 'danger');
  }
}

/**
 * Load all staff members from the database
 * Populate the specialist dropdown
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
      showStatusMessage('Error loading specialists. Please try again.', 'danger');
      return;
    }

    const specialistSelect = document.getElementById('specialistSelect');
    if (!specialistSelect) return;

    // Clear existing options except the first placeholder
    specialistSelect.innerHTML = '<option value="">Choose a specialist...</option>';

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
    showStatusMessage('An unexpected error occurred. Please try again.', 'danger');
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
      showStatusMessage('Please log in to book an appointment.', 'danger');
      window.location.href = 'login.html';
      return;
    }

    // Get form values
    const serviceId = document.getElementById('serviceSelect').value;
    const employeeId = document.getElementById('specialistSelect').value;
    const appointmentDateTime = document.getElementById('appointmentDateTime').value;

    // Validate inputs
    if (!serviceId || !employeeId || !appointmentDateTime) {
      showStatusMessage('Please fill in all required fields.', 'warning');
      return;
    }

    // Disable form during submission
    const submitButton = document.querySelector('#bookingForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Booking...';
    }

    // Create booking object
    const booking = {
      client_id: session.user.id,
      service_id: serviceId,
      employee_id: employeeId,
      appointment_date: new Date(appointmentDateTime).toISOString(),
      status: 'pending'
    };

    // Insert booking into database
    const { data, error } = await supabase
      .from('bookings')
      .insert([booking])
      .select();

    if (error) {
      console.error('Error creating booking:', error);
      showStatusMessage(`Error booking appointment: ${error.message}`, 'danger');
      
      // Re-enable form button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Book Appointment';
      }
      return;
    }

    showStatusMessage('Appointment booked successfully! We will confirm your booking shortly.', 'success');

    // Reset form
    document.getElementById('bookingForm').reset();

    // Re-enable form button
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Book Appointment';
    }

    // Optionally redirect after a delay
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
  } catch (error) {
    console.error('Unexpected error submitting booking:', error);
    showStatusMessage(`An unexpected error occurred: ${error.message}`, 'danger');

    // Re-enable form button
    const submitButton = document.querySelector('#bookingForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Book Appointment';
    }
  }
}

/**
 * Display status message to user
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showStatusMessage(message, type = 'info') {
  const statusDiv = document.getElementById('statusMessage');

  if (!statusDiv) return;

  statusDiv.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  // Auto-dismiss success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      const alert = statusDiv.querySelector('.alert');
      if (alert) {
        alert.remove();
      }
    }, 3000);
  }
}
