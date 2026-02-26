import { supabase } from '../services/supabaseClient.js';

/**
 * Load profile information from public.profiles table with fallback to auth metadata
 */
const loadProfileInfo = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Fetch real data from profiles table
    const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();
    
    if (profile) {
      if (document.getElementById('profileName')) document.getElementById('profileName').value = profile.full_name || user.user_metadata.full_name || '';
      if (document.getElementById('profilePhone')) document.getElementById('profilePhone').value = profile.phone || user.user_metadata.phone || '';
    }
  }

  // Check if newly registered and show welcome alert
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('new') === 'true') {
    const profileAlert = document.getElementById('profileAlert');
    if (profileAlert) {
      profileAlert.classList.remove('d-none');
    }
    const welcomeMsg = "Добре дошли! Моля допълнете профила си с ваше име и телефоннен номер.";
    if (profileAlert && profileAlert.innerHTML !== welcomeMsg) {
      profileAlert.innerHTML = `<span>${welcomeMsg}</span>`;
    }
    // Remove the query parameter from URL for cleaner navigation
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

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

    // Load user profile information from auth metadata
    await loadProfileInfo();
    setupFormSubmission();
    setupFeedbackFormSubmission();

    // Load bookings
    await loadMyBookings(session.user.id);

    // Setup cancel button event delegation
    setupCancelButtonDelegation();
    
    // Setup feedback button event delegation
    setupFeedbackButtonDelegation();
  } catch (error) {
    console.error('Error initializing profile page:', error);
    showMessage('Грешка при зареждане на профил. Моля, обновете страницата.', 'danger');
  }
});



/**
 * Setup form submission handling
 */
function setupFormSubmission() {
  const form = document.getElementById('profileInfoForm');
  
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.innerHTML = 'Запазване...';
    saveBtn.disabled = true;

    const fullName = document.getElementById('profileName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();

    // Basic validation
    if (!fullName || !phone) {
      showMessage('Моля, попълнете всички полета.', 'warning');
      saveBtn.innerHTML = 'Запази промените';
      saveBtn.disabled = false;
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in.");

      // Update the public.profiles table directly
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: phone })
        .eq('id', user.id);

      if (error) throw error;
      
      // Optionally update auth metadata too just in case
      await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone } });

      // Hide the new registration alert if visible
      const profileAlert = document.getElementById('profileAlert');
      if (profileAlert) {
        profileAlert.classList.add('d-none');
      }

      showMessage('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      showMessage('Грешка при актуализиране на профил: ' + error.message, 'danger');
    } finally {
      saveBtn.innerHTML = 'Запази промените';
      saveBtn.disabled = false;
    }
  });
}

/**
 * Setup feedback form submission handling
 */
function setupFeedbackFormSubmission() {
  const form = document.getElementById('feedbackForm');
  
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingId = document.getElementById('feedbackBookingId').value;
    const rating = parseInt(document.getElementById('feedbackRating').value);
    const notes = document.getElementById('feedbackNotes').value.trim();

    if (!bookingId || !rating || rating < 1 || rating > 5) {
      Swal.fire('Грешка!', 'Моля, предоставете валидна оценка (1-5).', 'error');
      return;
    }

    const submitBtn = document.getElementById('submitFeedbackBtn');
    submitBtn.innerHTML = 'Изпращане...';
    submitBtn.disabled = true;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ rating: rating, feedback_notes: notes })
        .eq('id', bookingId);

      if (error) throw error;

      // Close the modal
      const feedbackModal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
      if (feedbackModal) {
        feedbackModal.hide();
      }

      showMessage('Мр\u0430чи На вас! Вашят отзив и их оценка бяха тримари.', 'success');

      // Reload bookings to reflect the change
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        await loadMyBookings(session.user.id);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Swal.fire('Грешка!', 'Неуспешно изпращане на отзив: ' + error.message, 'error');
    } finally {
      submitBtn.innerHTML = 'Изпрати оценка';
      submitBtn.disabled = false;
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
 * Load user's bookings and display in separate sections (upcoming and history)
 * @param {string} userId - The user's ID
 */
async function loadMyBookings(userId) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, appointment_date, status, service_id, employee_id, rating, services(name), specialist:profiles!bookings_employee_id_fkey(full_name)')
      .eq('client_id', userId)
      .order('appointment_date', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      return;
    }

    if (!bookings || bookings.length === 0) {
      document.getElementById('upcomingBookingsContainer').innerHTML = '<p class="text-muted mb-0">No upcoming appointments.</p>';
      document.getElementById('historyBookingsContainer').innerHTML = '<p class="text-muted mb-0">No booking history.</p>';
      return;
    }

    // Filter bookings into upcoming (confirmed/pending) and history (completed/cancelled)
    const upcomingBookings = bookings.filter(b => 
      b.status === 'confirmed' || b.status === 'pending'
    );

    const historyBookings = bookings.filter(b => 
      b.status === 'completed' || b.status === 'cancelled'
    );

    // Sort history by date descending (most recent first)
    historyBookings.sort((a, b) => 
      new Date(b.appointment_date) - new Date(a.appointment_date)
    );

    // Render both sections
    renderBookingsTable('upcomingBookingsContainer', upcomingBookings);
    renderBookingsTable('historyBookingsContainer', historyBookings);

  } catch (error) {
    console.error('Unexpected error loading bookings:', error);
  }
}

/**
 * Render bookings into a table in the specified container
 * @param {string} containerId - The ID of the container to render into
 * @param {Array} bookings - The array of bookings to render
 */
function renderBookingsTable(containerId, bookings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!bookings || bookings.length === 0) {
    const emptyMessage = containerId === 'upcomingBookingsContainer' 
      ? 'Ханяма предстоящи часове.' 
      : 'Няма история на резервации.';
    container.innerHTML = `<p class="text-muted mb-0">${emptyMessage}</p>`;
    return;
  }

  let html = `<table class="table table-striped table-hover align-middle mb-0">
    <thead>
      <tr>
        <th>Услуга</th>
        <th>Специалист</th>
        <th>Дата и Час</th>
        <th>Статус</th>
        <th>Действия</th>
      </tr>
    </thead>
    <tbody>`;

  bookings.forEach(booking => {
    const appointmentDate = new Date(booking.appointment_date);
    const formattedDate = appointmentDate.toLocaleString();
    const specialistName = booking.specialist?.full_name || 'N/A';
    const isEditable = booking.status !== 'cancelled' && booking.status !== 'completed';
    const statusMap = {
      'confirmed': 'Потвърден',
      'pending': 'Чакащ',
      'cancelled': 'Отказан',
      'completed': 'Приключен'
    };
    const statusDisplay = statusMap[booking.status] || booking.status;

    let buttonsHTML = '';
    if (isEditable) {
      buttonsHTML = `<button class="btn btn-sm btn-danger cancel-btn" data-id="${booking.id}">Отказ</button>`;
    } else if (booking.status === 'completed' && !booking.rating) {
      buttonsHTML = `<button class="btn btn-sm btn-primary feedback-btn" data-id="${booking.id}">Остави отзив</button>`;
    }

    html += `
      <tr>
        <td>${booking.services.name}</td>
        <td>${specialistName}</td>
        <td>${formattedDate}</td>
        <td><span class="badge bg-${getStatusBadgeClass(booking.status)}">${statusDisplay}</span></td>
        <td>${buttonsHTML}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
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
 * Setup event delegation for feedback buttons
 * Opens the feedback modal when clicked
 */
function setupFeedbackButtonDelegation() {
  document.addEventListener('click', async (e) => {
    const feedbackBtn = e.target.closest('.feedback-btn');
    
    if (feedbackBtn) {
      const bookingId = feedbackBtn.getAttribute('data-id');
      if (!bookingId) return;
      
      // Set the booking ID in the hidden input
      document.getElementById('feedbackBookingId').value = bookingId;
      
      // Reset the form
      document.getElementById('feedbackForm').reset();
      document.getElementById('feedbackRating').value = 5;
      
      // Show the modal
      const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
      feedbackModal.show();
    }
  });
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
      Swal.fire({
        title: 'Отказване на часа?',
        text: 'Сигурни ли сте, че искате да откажете тази резервация?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Да, откажи',
        cancelButtonText: 'Назад'
      }).then(async (result) => {
        if (result.isConfirmed) {
          const originalText = cancelBtn.innerHTML;
          cancelBtn.innerHTML = "Отказване...";
          cancelBtn.disabled = true;

          try {
            // Soft-delete the record by updating status and tracking the canceller
            const { error } = await supabase
              .from('bookings')
              .update({ status: 'cancelled', cancelled_by: 'client' })
              .eq('id', bookingId);

            if (error) throw error;

            Swal.fire('Отказан!', 'Вашият час беше успешно отказан.', 'success');
            
            // Reload bookings
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
              await loadMyBookings(session.user.id);
            }
            
          } catch (error) {
            console.error("Error cancelling booking:", error);
            Swal.fire('Грешка!', 'Неуспешно отказване: ' + error.message, 'error');
            cancelBtn.innerHTML = originalText;
            cancelBtn.disabled = false;
          }
        }
      });
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
