// Import the Supabase client
import { supabase } from './supabaseClient.js';

// Get DOM elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authMessage = document.getElementById('authMessage');

/**
 * Display a message in the authMessage div
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'danger' for Bootstrap alert class
 */
function displayMessage(message, type) {
    authMessage.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

/**
 * Handle user registration
 * Prevents default form submission, validates input, and calls Supabase signUp
 */
async function handleRegister(e) {
    e.preventDefault();

    // Get form values
    const fullName = document.getElementById('registerFullName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    try {
        // Call Supabase auth.signUp with full_name in options.data
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            Swal.fire('Грешка!', `Грешка при регистрация: ${error.message}`, 'error');
            return;
        }

        registerForm.reset();
        
        // Show success modal and redirect to profile after dismissal
        Swal.fire('Успех!', 'Регистрацията беше успешна! Пренасочване на профила...', 'success').then(() => {
            window.location.href = 'profile.html?new=true';
        });
    } catch (error) {
        Swal.fire('Грешка!', `Възникна неочаквана грешка: ${error.message}`, 'error');
    }
}

/**
 * Handle user login
 * Prevents default form submission and calls Supabase signInWithPassword
 * Redirects to index.html on successful login
 */
async function handleLogin(e) {
    e.preventDefault();

    // Get form values
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        // Call Supabase auth.signInWithPassword
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            Swal.fire('Грешка!', `Грешка при вход: ${error.message}`, 'error');
            return;
        }

        loginForm.reset();

        // Show success modal and redirect after dismissal
        Swal.fire('Успех!', 'Успешен вход! Пренасочване...', 'success').then(() => {
            window.location.href = 'index.html';
        });
    } catch (error) {
        Swal.fire('Грешка!', `Възникна неочаквана грешка: ${error.message}`, 'error');
    }
}

// Add event listeners if forms exist
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}
