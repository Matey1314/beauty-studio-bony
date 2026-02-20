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
            displayMessage(`Registration Error: ${error.message}`, 'danger');
            return;
        }

        displayMessage('Registration successful! Please check your email to confirm your account.', 'success');
        registerForm.reset();
    } catch (error) {
        displayMessage(`An unexpected error occurred: ${error.message}`, 'danger');
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
            displayMessage(`Login Error: ${error.message}`, 'danger');
            return;
        }

        displayMessage('Login successful! Redirecting...', 'success');
        loginForm.reset();

        // Redirect to index.html after successful login
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        displayMessage(`An unexpected error occurred: ${error.message}`, 'danger');
    }
}

// Add event listeners if forms exist
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}
