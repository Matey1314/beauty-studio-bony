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
      // User is logged in - update navbar for authenticated state
      await updateNavbarLoggedIn(session);
      await handleRoleBasedAccessControl(session);
    } else {
      // User is not logged in - update navbar for unauthenticated state
      updateNavbarLoggedOut();
      
      // Check if user is trying to access protected pages
      const currentPage = getCurrentPageName();
      if (currentPage === 'booking.html' || currentPage === 'admin.html' || currentPage === 'profile.html') {
        window.location.href = 'login.html';
      }
    }
  } catch (error) {
    console.error('Error checking session:', error);
    updateNavbarLoggedOut();
  }
}

/**
 * Fetch user role from profiles table
 * @param {Object} session - The auth session object
 * @returns {Promise<string|null>} The user's role or null if not found
 */
async function getUserRole(session) {
  try {
    console.log('Session User ID:', session.user.id);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }

    console.log('Fetched Role Data:', data);
    return data?.role || null;
  } catch (error) {
    console.error('Unexpected error fetching user role:', error);
    return null;
  }
}

/**
 * Update navbar UI for logged-in users
 * @param {Object} session - The auth session object
 */
async function updateNavbarLoggedIn(session) {
  // Show My Profile link
  const navProfileLink = document.getElementById('navProfileLink');
  if (navProfileLink) {
    navProfileLink.style.display = 'block';
  }

  // Update Login link to Logout
  const navLoginLink = document.getElementById('navLoginLink');
  if (navLoginLink) {
    // Clone and replace to remove old event listeners
    const newNavLoginLink = navLoginLink.cloneNode(true);
    navLoginLink.parentNode.replaceChild(newNavLoginLink, navLoginLink);

    const updatedNavLoginLink = document.getElementById('navLoginLink');
    updatedNavLoginLink.textContent = 'Logout';
    updatedNavLoginLink.href = '#';
    
    // Add logout click event listener
    updatedNavLoginLink.addEventListener('click', async (e) => {
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
  // Hide My Profile link
  const navProfileLink = document.getElementById('navProfileLink');
  if (navProfileLink) {
    navProfileLink.style.display = 'none';
  }

  // Hide Admin Panel link
  const navAdminLink = document.getElementById('navAdminLink');
  if (navAdminLink) {
    navAdminLink.style.display = 'none';
  }

  // Reset Login link
  const navLoginLink = document.getElementById('navLoginLink');
  if (navLoginLink) {
    // Clone and replace to remove event listeners
    const newNavLoginLink = navLoginLink.cloneNode(true);
    navLoginLink.parentNode.replaceChild(newNavLoginLink, navLoginLink);

    const updatedNavLoginLink = document.getElementById('navLoginLink');
    updatedNavLoginLink.textContent = 'Login';
    updatedNavLoginLink.href = 'login.html';
  }
}

/**
 * Handle role-based access control
 * @param {Object} session - The auth session object
 */
async function handleRoleBasedAccessControl(session) {
  try {
    const userRole = await getUserRole(session);
    const navAdminLink = document.getElementById('navAdminLink');

    // Handle admin link visibility based on user role
    if (navAdminLink) {
      if (userRole && (userRole === 'admin' || userRole === 'staff')) {
        navAdminLink.style.display = 'block';
        // Keep the link text as is (Admin Panel or Dashboard based on what's in HTML)
      } else {
        navAdminLink.style.display = 'none';
      }
    }

    // Redirect non-admin/staff users from admin page
    const currentPage = getCurrentPageName();
    if (currentPage === 'admin.html' && userRole !== 'admin' && userRole !== 'staff') {
      alert('Access Denied');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Error handling role-based access control:', error);
    // Hide admin link on error for safety
    const navAdminLink = document.getElementById('navAdminLink');
    if (navAdminLink) {
      navAdminLink.style.display = 'none';
    }
  }
}

/**
 * Setup listener for auth state changes (login/logout events)
 */
function setupAuthStateChangeListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      // User just signed in
      await updateNavbarLoggedIn(session);
      await handleRoleBasedAccessControl(session);
    } else if (event === 'SIGNED_OUT') {
      // User just signed out
      updateNavbarLoggedOut();
      
      // Redirect from protected pages
      const currentPage = getCurrentPageName();
      if (currentPage === 'booking.html' || currentPage === 'admin.html' || currentPage === 'profile.html') {
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
