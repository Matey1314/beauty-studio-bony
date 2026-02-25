import { supabase } from '../services/supabaseClient.js';

// Business hours and slot duration constants
const WORK_START = 10;
const WORK_END = 18;
const SLOT_DURATION = 60; // in minutes

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
    setupTimeSlotListeners();
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
    initializeFlatpickr();
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
 * Setup time slot change event listeners
 */
function setupTimeSlotListeners() {
  const serviceSelect = document.getElementById('bookingService');
  const specialistSelect = document.getElementById('bookingSpecialist');
  const dateInput = document.getElementById('bookingDate');

  if (serviceSelect) {
    serviceSelect.addEventListener('change', generateTimeSlots);
  }
  if (specialistSelect) {
    specialistSelect.addEventListener('change', generateTimeSlots);
  }
  if (dateInput) {
    dateInput.addEventListener('change', generateTimeSlots);
  }
}

/**
 * Initialize Flatpickr date picker
 */
function initializeFlatpickr() {
  flatpickr("#bookingDate", {
    minDate: "today", // Prevents booking in the past
    dateFormat: "Y-m-d", // Matches our Supabase logic
    altInput: true,
    altFormat: "F j, Y", // Beautiful display format (e.g., February 24, 2026)
    onChange: function(selectedDates, dateStr, instance) {
      // Manually trigger the generateTimeSlots logic since we bypassed the native 'change' event
      const event = new Event('change');
      document.getElementById('bookingDate').dispatchEvent(event);
    }
  });
}

/**
 * Generate and display available time slots
 */
async function generateTimeSlots() {
  try {
    const serviceVal = document.getElementById('bookingService').value;
    const specialistVal = document.getElementById('bookingSpecialist').value;
    const dateVal = document.getElementById('bookingDate').value;
    const container = document.getElementById('timeSlotsContainer');

    // Clear the hidden time input when selections change
    document.getElementById('bookingTime').value = '';

    // If any required field is empty, show the initial message
    if (!serviceVal || !specialistVal || !dateVal) {
      container.innerHTML = '<p class="text-muted small w-100 text-center mb-0">Please select a Service, Specialist, and Date first to see available times.</p>';
      return;
    }

    // Show loading message
    container.innerHTML = '<p class="text-muted small w-100 text-center mb-0">Loading available slots...</p>';

    // Fetch existing bookings for the specialist on the selected date
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('appointment_date, services(duration_minutes)')
      .eq('employee_id', specialistVal)
      .gte('appointment_date', `${dateVal}T00:00:00`)
      .lte('appointment_date', `${dateVal}T23:59:59`)
      .neq('status', 'cancelled');

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      container.innerHTML = '<p class="text-danger small w-100 text-center mb-0">Error loading available times. Please try again.</p>';
      return;
    }

    // Generate time slots
    const slots = [];
    for (let hour = WORK_START; hour < WORK_END; hour++) {
      const timeString = `${String(hour).padStart(2, '0')}:00`;
      slots.push({ hour, timeString });
    }

    // Get today's date to check for past times
    const today = new Date();
    const selectedDate = new Date(`${dateVal}T00:00:00`);
    const isToday = today.toDateString() === selectedDate.toDateString();
    const now = new Date();

    // Render time slot buttons
    let slotsHTML = '';

    slots.forEach(slot => {
      const slotStartTime = new Date(`${dateVal}T${slot.timeString}:00`);
      const slotEndTime = new Date(slotStartTime.getTime() + SLOT_DURATION * 60000);

      // Check if slot is in the past
      const isPast = isToday && slotStartTime < now;

      // Check for overlaps with existing bookings
      let isOverlapping = false;
      if (bookings && bookings.length > 0) {
        isOverlapping = bookings.some(booking => {
          const bookingStartTime = new Date(booking.appointment_date);
          const bookingDuration = booking.services?.duration_minutes || 60;
          const bookingEndTime = new Date(bookingStartTime.getTime() + bookingDuration * 60000);

          return (slotStartTime < bookingEndTime) && (slotEndTime > bookingStartTime);
        });
      }

      // Render button based on availability
      if (isPast || isOverlapping) {
        slotsHTML += `<button type="button" class="btn btn-danger btn-sm" style="width: 75px;" disabled>${slot.timeString}</button>`;
      } else {
        slotsHTML += `<button type="button" class="btn btn-outline-success btn-sm time-slot-btn" data-time="${slot.timeString}" style="width: 75px;">${slot.timeString}</button>`;
      }
    });

    container.innerHTML = slotsHTML;

    // Attach click listeners to time slot buttons
    const timeSlotButtons = document.querySelectorAll('.time-slot-btn');
    timeSlotButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();

        // Remove highlighting from all buttons
        timeSlotButtons.forEach(btn => {
          btn.classList.remove('btn-success', 'text-white');
          btn.classList.add('btn-outline-success');
        });

        // Highlight the clicked button
        button.classList.remove('btn-outline-success');
        button.classList.add('btn-success', 'text-white');

        // Set the hidden time input value
        document.getElementById('bookingTime').value = button.dataset.time;
      });
    });
  } catch (error) {
    console.error('Error generating time slots:', error);
    const container = document.getElementById('timeSlotsContainer');
    container.innerHTML = '<p class="text-danger small w-100 text-center mb-0">Error loading available times. Please try again.</p>';
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
    const appointmentDateTime = `${dateVal}T${timeVal}:00`;
    const appointmentDate = new Date(appointmentDateTime).toISOString();

    // Create booking object
    const booking = {
      client_id: session.user.id,
      service_id: serviceVal,
      employee_id: specialistVal,
      appointment_date: appointmentDate,
      status: 'confirmed'
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

