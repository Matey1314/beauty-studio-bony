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

    // Load bookings
    await loadMyBookings(session.user.id);

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
      const isEditable = booking.status !== 'cancelled' && booking.status !== 'completed';
      const statusDisplay = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

      let buttonsHTML = '';
      if (isEditable) {
        buttonsHTML = `
          <button class="btn btn-sm btn-danger cancel-btn" data-id="${booking.id}">Cancel</button>
        `;
      }

      row.innerHTML = `
        <td>${booking.services.name}</td>
        <td>${specialistName}</td>
        <td>${formattedDate}</td>
        <td><span class="badge bg-${getStatusBadgeClass(booking.status)}">${statusDisplay}</span></td>
        <td>${buttonsHTML}</td>
      `;
      tableBody.appendChild(row);
    });
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
 * Setup event delegation for cancel buttons
 * Handles clicks on dynamically generated Cancel buttons
 * Soft-deletes bookings by setting status to 'cancelled' and tracking the canceller
 */
function setupCancelButtonDelegation() {
  document.addEventListener('click', async (e) => {
    const cancelBtn = e.target.closest('.cancel-btn');
    
    if (cancelBtn) {
      const bookingId = cancelBtn.getAttribute('data-id');
      
      if (!bookingId) return;

      // Ask for confirmation before cancelling
      if (confirm("Are you sure you want to cancel this appointment?")) {
        const originalText = cancelBtn.innerHTML;
        cancelBtn.innerHTML = "Cancelling...";
        cancelBtn.disabled = true;

        try {
          // Soft-delete the record by updating status and tracking the canceller
          const { error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancelled_by: 'client' })
            .eq('id', bookingId);

          if (error) throw error;

          alert("Your appointment has been successfully cancelled.");
          
          // Reload bookings
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            await loadMyBookings(session.user.id);
          }
          
        } catch (error) {
          console.error("Error cancelling booking:", error);
          alert("Failed to cancel: " + error.message);
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
