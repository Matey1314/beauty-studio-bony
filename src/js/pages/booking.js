import { supabase } from '../services/supabaseClient.js';

// Business hours and slot duration constants
const WORK_START = 10;
const WORK_END = 18;
const SLOT_DURATION = 60; // in minutes

/**
 * Step 1: Standardize the global state and navigation
 * Ensure these exist clearly at the top for reliable access
 */
window.bookingState = window.bookingState || {
  specialistId: '', // specialist UUID (for reliable DB matching)
  specialistName: '', // specialist full name (for display)
  service: '', // service name
  serviceId: '', // service ID
  servicePrice: 0, // service price
  date: '', // booking date
  time: '' // booking time
};

/**
 * Step 2: Global navigation function for wizard
 * Manages visible steps in the booking wizard
 */
window.goToStep = (step) => {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('d-none'));
  const stepEl = document.getElementById('step' + step);
  if (stepEl) stepEl.classList.remove('d-none');
};

/**
 * Step 1→2 Transition: Unified function that handles specialist selection,
 * services fetching, filtering, and rendering in one go
 * @param {string} id - The specialist's UUID
 * @param {string} name - The specialist's full name
 */
window.selectSpecialist = async (id, name) => {
  try {
    console.log("🔥 1. CLICKED ID:", id, "NAME:", name);
    window.bookingState.specialistId = id;
    window.bookingState.specialistName = name; // Save name for the final submission if needed
    window.goToStep(2);
    
    const servicesList = document.getElementById('wizardServicesList');
    if (!servicesList) return;
    servicesList.innerHTML = '<div class="col-12 text-center text-muted mt-4">Зареждане на услуги...</div>';

    // Fetch services directly here
    const { data: services, error } = await supabase.from('services').select('*');
    if (error) throw error;
    
    console.log("🔥 2. ALL SERVICES:", services);

    // Filter by specialist_id instead of name
    const filteredServices = services.filter(service => service.specialist_id === id);

    console.log("🔥 3. MATCHED SERVICES:", filteredServices);

    servicesList.innerHTML = '';

    if (filteredServices.length === 0) {
      servicesList.innerHTML = '<div class="col-12 text-center text-muted mt-4">Този специалист няма добавени услуги.</div>';
      return;
    }

    filteredServices.forEach(service => {
      const safeServiceName = service.name.replace(/'/g, "\\'");
      // Notice: using duration_minutes based on DB schema
      const duration = service.duration_minutes || service.duration || 0;
      
      servicesList.innerHTML += `
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4 h-100 p-3 text-center" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" onclick="window.bookingState.service = '${safeServiceName}'; window.bookingState.serviceId = '${service.id}'; window.bookingState.servicePrice = ${service.price}; window.goToStep(3)">
            <div class="card-body">
              <h5 class="fw-bold mb-2">${service.name}</h5>
              <p class="text-muted small mb-3">${service.description || ''}</p>
              <span class="badge bg-dark text-white p-2 fs-6">${service.price} лв. / ${duration} мин</span>
            </div>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("🔥 FATAL ERROR:", err);
    document.getElementById('wizardServicesList').innerHTML = '<div class="col-12 text-center text-danger mt-4">Възникна грешка. Моля, опитайте отново.</div>';
  }
};

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
 * Load specialists and services
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await checkSession();
    if (!session) return;

    // Initialize step 1 with specialists
    await initializeStep1();
    
    // Setup step 3 handlers for date/time
    setupStep3();

    console.log('Booking page initialized with booking state:', window.bookingState);
  } catch (error) {
    console.error('Error initializing booking page:', error);
    showBookingMessage('Error loading booking form. Please refresh the page.', 'danger');
  }
});

/**
 * Initialize Step 1: Load and display specialists
 */
async function initializeStep1() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, services_offered')
      .eq('role', 'staff')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching specialists:', error);
      showBookingMessage('Error loading specialists. Please try again.', 'danger');
      return;
    }

    const listContainer = document.getElementById('wizardSpecialistsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (!data || data.length === 0) {
      listContainer.innerHTML = '<div class="text-center text-muted w-100">No specialists available at the moment.</div>';
      return;
    }

    // Render specialist cards
    data.forEach(specialist => {
      const card = document.createElement('div');
      card.className = 'col-md-4 col-sm-6 text-center';
      
      // Extract exact name with proper fallbacks
      const specName = specialist.full_name || specialist.name || specialist.first_name || 'Unknown';
      const safeName = specName.replace(/'/g, "\\'"); // Escape single quotes for safe HTML attribute
      
      card.innerHTML = `
        <div class="card border-0 shadow-sm rounded-4 p-3 cursor-pointer specialist-card" style="cursor: pointer; transition: all 0.3s;" onclick="window.selectSpecialist('${specialist.id}', '${safeName}')">
          ${specialist.avatar_url ? `<img src="${specialist.avatar_url}" class="rounded-circle mx-auto d-block mb-3" style="width: 100px; height: 100px; object-fit: cover;" alt="${specName}">` : '<div class="mx-auto d-block mb-3 bg-light rounded-circle" style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;"><i class="bi bi-person" style="font-size: 2rem; color: #ccc;"></i></div>'}
          <h6 class="fw-bold">${specName}</h6>
          ${specialist.bio ? `<p class="text-muted small">${specialist.bio}</p>` : ''}
        </div>
      `;
      
      listContainer.appendChild(card);
    });

    // Add hover effects to specialist cards
    document.querySelectorAll('.specialist-card').forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '';
      });
    });
  } catch (error) {
    console.error('Unexpected error initializing step 1:', error);
    showBookingMessage('An unexpected error occurred. Please try again.', 'danger');
  }
}


/**
 * Handle service selection and move to step 3 (kept for backward compatibility if needed)
 * Now handled inline in loadFilteredServices onclick handlers
 */
function selectService(service) {
  window.bookingState.service = service.name;
  window.bookingState.serviceId = service.id;
  window.bookingState.servicePrice = service.price;

  console.log('Selected Service:', service.name, 'ID:', service.id, 'Price:', service.price);

  // Move to date/time selection
  window.goToStep(3);
}

/**
 * Setup Step 3: Date and Time selection with dynamic availability
 */
function setupStep3() {
  const wizardDateInput = document.getElementById('wizardDate');
  const timeSlotsContainer = document.getElementById('timeSlotsContainer');
  const submitBtn = document.getElementById('wizardSubmitBtn');

  // Prevent picking past dates
  const today = new Date().toISOString().split('T')[0];
  if (wizardDateInput) wizardDateInput.setAttribute('min', today);

  if (wizardDateInput) {
    wizardDateInput.addEventListener('change', async (e) => {
      const selectedDate = e.target.value;
      window.bookingState.date = selectedDate;
      window.bookingState.time = ''; // Reset time selection

      if (!selectedDate) {
        timeSlotsContainer.innerHTML = '<div class="text-muted mt-2 small">Моля, изберете дата първо.</div>';
        return;
      }

      timeSlotsContainer.innerHTML = '<div class="spinner-border spinner-border-sm text-dark me-2" role="status"></div><span class="text-muted">Проверка на графика...</span>';

      try {
        // Fetch booked times for THIS specialist on THIS date
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('appointment_date')
          .eq('employee_id', window.bookingState.specialistId)
          .gte('appointment_date', `${selectedDate}T00:00:00`)
          .lt('appointment_date', `${selectedDate}T23:59:59`)
          .in('status', ['confirmed', 'pending']);
        
        if (error) throw error;

        // Extract just the "HH:MM" part from the database time strings
        const bookedTimes = bookings.map(b => {
          const date = new Date(b.appointment_date);
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${hours}:${minutes}`;
        });
        
        console.log('🔥 Booked times for', window.bookingState.specialistName, 'on', selectedDate, ':', bookedTimes);
        
        // Define your salon's working hours here
        const allSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
        
        timeSlotsContainer.innerHTML = '';
        let hasAvailable = false;

        allSlots.forEach(slot => {
          const isBooked = bookedTimes.includes(slot);
          
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `btn rounded-pill px-3 py-2 fw-bold ${isBooked ? 'btn-danger disabled opacity-50' : 'btn-outline-dark time-slot-btn'}`;
          btn.innerText = slot;
          btn.disabled = isBooked;
          
          if (!isBooked) {
            hasAvailable = true;
            btn.onclick = () => {
              // Deselect others (remove green, add back outline)
              document.querySelectorAll('.time-slot-btn').forEach(b => {
                b.classList.remove('btn-success', 'text-white');
                b.classList.add('btn-outline-dark');
              });
              // Select current (remove outline, add green)
              btn.classList.remove('btn-outline-dark');
              btn.classList.add('btn-success', 'text-white');
              window.bookingState.time = slot;
              console.log('🔥 Time selected:', slot);
            };
          }
          
          timeSlotsContainer.appendChild(btn);
        });

        if (!hasAvailable) {
          timeSlotsContainer.innerHTML = '<div class="text-danger fw-bold mt-2">Няма свободни часове за тази дата!</div>';
        }

      } catch (err) {
        console.error("🔥 ERROR FETCHING SLOTS:", err);
        timeSlotsContainer.innerHTML = '<div class="text-danger mt-2">Грешка при зареждане на часовете.</div>';
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitWizardBooking);
  }
}

/**
 * Submit the booking with all validated data
 */
async function submitWizardBooking() {
  try {
    // Validate date and time selection
    if (!window.bookingState.date || !window.bookingState.time) {
      alert("Моля, изберете дата и час за вашата резервация!");
      return;
    }

    // Validate all required fields from window.bookingState
    if (!window.bookingState.specialistId || !window.bookingState.serviceId) {
      showBookingMessage('Please complete all wizard steps. Specialist: ' + window.bookingState.specialistId + ', Service: ' + window.bookingState.serviceId, 'warning');
      return;
    }

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      showBookingMessage('Please log in to book an appointment.', 'danger');
      window.location.href = 'login.html';
      return;
    }

    // Get user profile to check for phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || !profile.phone) {
      showBookingMessage('Please complete your profile with a phone number before booking.', 'warning');
      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 2000);
      return;
    }

    // Disable submit button
    const submitBtn = document.getElementById('wizardSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Потвърждаване...';

    // Combine date and time into ISO string
    const appointmentDateTime = `${window.bookingState.date}T${window.bookingState.time}:00`;
    const appointmentDate = new Date(appointmentDateTime).toISOString();

    console.log('Submitting booking:', {
      client_id: session.user.id,
      service_id: window.bookingState.serviceId,
      employee_id: window.bookingState.specialistId,
      appointment_date: appointmentDate,
      specialist_name: window.bookingState.specialistName
    });

    // Create booking
    const booking = {
      client_id: session.user.id,
      service_id: window.bookingState.serviceId,
      employee_id: window.bookingState.specialistId,
      appointment_date: appointmentDate,
      status: 'confirmed'
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert([booking])
      .select();

    if (error) {
      console.error('Error creating booking:', error);
      showBookingMessage(`Грешка при резервация: ${error.message}`, 'danger');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    showBookingMessage('Резервацията е потвърдена! Пренасочване на профила...', 'success');

    // Reset state
    window.bookingState = {
      specialistId: '',
      specialistName: '',
      service: '',
      serviceId: '',
      servicePrice: 0,
      date: '',
      time: ''
    };

    // Reset form
    document.getElementById('wizardDate').value = '';

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 2000);
  } catch (error) {
    console.error('Unexpected error submitting booking:', error);
    showBookingMessage(`Възникна грешка: ${error.message}`, 'danger');

    // Re-enable submit button
    const submitBtn = document.getElementById('wizardSubmitBtn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Потвърди резервацията';
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

