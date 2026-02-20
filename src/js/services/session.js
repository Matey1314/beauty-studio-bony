import { supabase } from './supabaseClient.js';

// Initialize session management on DOM loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializeSession();
  setupAuthStateChangeListener();
});

/**
 * Initialize the session by checking current user and updating UI accordingly
 */
async function initializeSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
      // User is logged in
      updateNavbarLoggedIn();
    } else {
      // User is not logged in
      updateNavbarLoggedOut();
      
      // Check if user is trying to access protected pages
      const currentPage = getCurrentPageName();
      if (currentPage === 'booking.html' || currentPage === 'admin.html') {
        window.location.href = 'login.html';
      }
    }
  } catch (error) {
    console.error('Error checking session:', error);
    updateNavbarLoggedOut();
  }
}

/**
 * Update navbar UI for logged-in users
 */
function updateNavbarLoggedIn() {
  const loginLink = document.querySelector('a[href="login.html"]');
  
  if (loginLink) {
    loginLink.textContent = 'Logout';
    loginLink.href = '#';
    loginLink.removeAttribute('href');
    
    // Add click event listener for logout functionality
    loginLink.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          alert('Error logging out: ' + error.message);
          return;
        }
        
        alert('You have logged out successfully!');
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Logout error:', error);
        alert('An error occurred while logging out.');
      }
    });
  }
}

/**
 * Update navbar UI for logged-out users
 */
function updateNavbarLoggedOut() {
  const loginLink = document.querySelector('a[href="login.html"]');
  
  if (loginLink) {
    loginLink.textContent = 'Login';
    loginLink.href = 'login.html';
    
    // Remove any logout click listeners that might exist
    const newLoginLink = loginLink.cloneNode(true);
    loginLink.parentNode.replaceChild(newLoginLink, loginLink);
  }
}

/**
 * Setup listener for auth state changes (login/logout events)
 */
function setupAuthStateChangeListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      // User just signed in
      updateNavbarLoggedIn();
    } else if (event === 'SIGNED_OUT') {
      // User just signed out
      updateNavbarLoggedOut();
      
      // Redirect from protected pages
      const currentPage = getCurrentPageName();
      if (currentPage === 'booking.html' || currentPage === 'admin.html') {
        window.location.href = 'login.html';
      }
    }
  });
}

/**
 * Get the current page filename
 * @returns {string} The filename of the current page
 */
function getCurrentPageName() {
  const pathname = window.location.pathname;
  return pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';
}
