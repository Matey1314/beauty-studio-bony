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
