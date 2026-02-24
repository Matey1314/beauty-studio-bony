import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize profile page
 * Check for active session and load user data
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      // No session, redirect to login
      window.location.href = 'login.html';
      return;
    }

    // Load user profile data
    await loadUserProfile(session.user.id);
    setupFormSubmission(session.user.id);

    // Load modal options and bookings
    await loadModalOptions();
    await loadMyBookings(session.user.id);

    // Setup edit booking form submission
    setupEditBookingFormSubmission();

    // Setup cancel button event delegation
    setupCancelButtonDelegation();
  } catch (error) {
    console.error('Error initializing profile page:', error);
    showMessage('Error loading profile. Please refresh the page.', 'danger');
  }
});

/**
 * Load user profile data from the profiles table
 * @param {string} userId - The user's ID
 */
async function loadUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      showMessage('Error loading profile data.', 'danger');
      return;
    }

    // Populate form fields with user data
    if (data) {
      document.getElementById('profileName').value = data.full_name || '';
      document.getElementById('profilePhone').value = data.phone || '';
    }
  } catch (error) {
    console.error('Unexpected error loading profile:', error);
    showMessage('An unexpected error occurred.', 'danger');
  }
}

/**
 * Setup form submission handling
 * @param {string} userId - The user's ID
 */
function setupFormSubmission(userId) {
  const form = document.getElementById('profileForm');
  
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('profileName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();

    // Basic validation
    if (!fullName || !phone) {
      showMessage('Please fill in all fields.', 'warning');
      return;
    }

    try {
      // Update profile in the database
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        showMessage('Error updating profile. Please try again.', 'danger');
        return;
      }

      showMessage('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      showMessage('An unexpected error occurred.', 'danger');
    }
  });
}

/**
 * Display a message in the profile message div
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showMessage(message, type) {
  const messageDiv = document.getElementById('profileMessage');
  
  if (!messageDiv) return;

  messageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  </div>`;

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

/**
 * Load modal options (services and specialists)
 * Populate the edit booking form dropdowns
 */
async function loadModalOptions() {
  try {
    // Fetch all services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name');

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return;
    }

    // Fetch all staff members
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'staff');

    if (staffError) {
      console.error('Error fetching staff:', staffError);
      return;
    }

    // Populate services dropdown
    const serviceSelect = document.getElementById('editService');
    if (serviceSelect) {
      services.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = service.name;
        serviceSelect.appendChild(option);
      });
    }

    // Populate specialists dropdown
    const specialistSelect = document.getElementById('editSpecialist');
    if (specialistSelect) {
      staff.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.full_name;
        specialistSelect.appendChild(option);
      });
    }

    // Initialize Flatpickr for the edit modal date/time input
    flatpickr('#editDateTime', {
      enableTime: true,
      minDate: 'today',
      dateFormat: 'Y-m-dTH:i',
      altInput: true,
      altFormat: 'F j, Y at h:i K'
    });
  } catch (error) {
    console.error('Error loading modal options:', error);
  }
}

/**
 * Load user's bookings and display in table
 * @param {string} userId - The user's ID
 */
async function loadMyBookings(userId) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, appointment_date, status, service_id, employee_id, services(name), specialist:profiles!bookings_employee_id_fkey(full_name)')
      .eq('client_id', userId)
      .order('appointment_date', { ascending: true });

    // Log bookings structure to verify specialist field
    console.log('Bookings data:', bookings);

    if (error) {
      console.error('Error fetching bookings:', error);
      showBookingsMessage('Error loading bookings.', 'danger');
      return;
    }

    const tableBody = document.getElementById('bookingsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No bookings found.</td></tr>';
      return;
    }

    bookings.forEach(booking => {
      const row = document.createElement('tr');
      const appointmentDate = new Date(booking.appointment_date);
      const formattedDate = appointmentDate.toLocaleString();
      const specialistName = booking.specialist?.full_name || 'N/A';

      row.innerHTML = `
        <td>${booking.services.name}</td>
        <td>${specialistName}</td>
        <td>${formattedDate}</td>
        <td><span class="badge bg-${getStatusBadgeClass(booking.status)}">${booking.status}</span></td>
        <td>
          <button class="btn btn-sm btn-warning edit-btn" data-id="${booking.id}" data-service-id="${booking.service_id}" data-employee-id="${booking.employee_id}" data-date="${booking.appointment_date}">Edit</button>
          <button class="btn btn-sm btn-danger cancel-btn" data-id="${booking.id}">Cancel</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Attach event listeners to Edit buttons
    attachEditButtonListeners();
  } catch (error) {
    console.error('Unexpected error loading bookings:', error);
    showBookingsMessage('An unexpected error occurred.', 'danger');
  }
}

/**
 * Get Bootstrap badge class based on booking status
 * @param {string} status - The booking status
 * @returns {string} Bootstrap badge class
 */
function getStatusBadgeClass(status) {
  const statusClasses = {
    'confirmed': 'success',
    'pending': 'warning',
    'cancelled': 'danger',
    'completed': 'secondary'
  };
  return statusClasses[status] || 'secondary';
}

/**
 * Attach event listeners to Edit buttons
 */
function attachEditButtonListeners() {
  const editButtons = document.querySelectorAll('.edit-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', function() {
      const bookingId = this.getAttribute('data-id');
      const serviceId = this.getAttribute('data-service-id');
      const employeeId = this.getAttribute('data-employee-id');
      const appointmentDate = this.getAttribute('data-date');

      // Set the hidden booking ID
      document.getElementById('editBookingId').value = bookingId;

      // Set the service dropdown
      document.getElementById('editService').value = serviceId;

      // Set the specialist dropdown
      document.getElementById('editSpecialist').value = employeeId;

      // Format and set the datetime-local input
      const date = new Date(appointmentDate);
      const formattedDateTime = formatDateTimeLocal(date);
      document.getElementById('editDateTime').value = formattedDateTime;

      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById('editBookingModal'));
      modal.show();
    });
  });
}

/**
 * Format date for datetime-local input (YYYY-MM-DDThh:mm)
 * @param {Date} date - The date to format
 * @returns {string} Formatted datetime string
 */
function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Setup edit booking form submission
 */
function setupEditBookingFormSubmission() {
  const form = document.getElementById('editBookingForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingId = document.getElementById('editBookingId').value;
    const newServiceId = document.getElementById('editService').value;
    const newEmployeeId = document.getElementById('editSpecialist').value;
    const newDateTime = document.getElementById('editDateTime').value;

    // Validate inputs
    if (!bookingId || !newServiceId || !newEmployeeId || !newDateTime) {
      showBookingsMessage('Please fill in all fields.', 'warning');
      return;
    }

    try {
      // Convert the datetime-local value to ISO 8601 format
      const dateTimeObj = new Date(newDateTime);
      const isoDateTime = dateTimeObj.toISOString();

      // Update the booking in Supabase
      const { error } = await supabase
        .from('bookings')
        .update({
          service_id: newServiceId,
          employee_id: newEmployeeId,
          appointment_date: isoDateTime
        })
        .eq('id', bookingId);

      if (error) {
        console.error('Error updating booking:', error);
        showBookingsMessage('Error updating booking. Please try again.', 'danger');
        return;
      }

      // Hide the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editBookingModal'));
      if (modal) {
        modal.hide();
      }

      // Show success message
      showBookingsMessage('Booking updated successfully!', 'success');

      // Reload bookings
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        await loadMyBookings(session.user.id);
      }
    } catch (error) {
      console.error('Unexpected error updating booking:', error);
      showBookingsMessage('An unexpected error occurred.', 'danger');
    }
  });
}

/**
 * Setup event delegation for cancel buttons
 * Handles clicks on dynamically generated Cancel buttons
 */
function setupCancelButtonDelegation() {
  document.addEventListener('click', async (e) => {
    const cancelBtn = e.target.closest('.cancel-btn');
    
    if (cancelBtn) {
      const bookingId = cancelBtn.getAttribute('data-id');
      
      if (!bookingId) return;

      // Ask for confirmation before permanently deleting
      if (confirm("Are you sure you want to permanently delete this appointment? This action cannot be undone.")) {
        const originalText = cancelBtn.innerHTML;
        cancelBtn.innerHTML = "Deleting...";
        cancelBtn.disabled = true;

        try {
          // Completely delete the record from the Supabase table
          const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);

          if (error) throw error;

          alert("Your appointment has been successfully deleted.");
          
          // Reload bookings
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            await loadMyBookings(session.user.id);
          }
          
        } catch (error) {
          console.error("Error deleting booking:", error);
          alert("Failed to delete: " + error.message);
          cancelBtn.innerHTML = originalText;
          cancelBtn.disabled = false;
        }
      }
    }
  });
}

/**
 * Display a message in the bookings message div
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showBookingsMessage(message, type) {
  const messageDiv = document.getElementById('bookingsMessage');
  
  if (!messageDiv) return;

  messageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  </div>`;

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
