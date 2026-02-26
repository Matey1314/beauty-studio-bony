import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize admin dashboard
 * Load and display content based on user role
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      console.error('No active session. User should have been redirected.');
      window.location.href = 'login.html';
      return;
    }

    await initializeDashboard(session);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }

  // Add listener to the form to save notes
  const dossierForm = document.getElementById('dossierForm');
  if (dossierForm) {
    dossierForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveDossierBtn');
      const originalText = btn.innerText;
      btn.innerText = 'Запазване...';
      btn.disabled = true;

      const clientId = document.getElementById('dossierClientId').value;
      const notes = document.getElementById('dossierNotes').value;

      try {
        // Upsert logic (Insert if doesn't exist, Update if it does)
        const { error } = await supabase
          .from('client_notes')
          .upsert({ client_id: clientId, notes: notes }, { onConflict: 'client_id' });

        if (error) throw error;

        // Close modal on success
        const modalEl = document.getElementById('dossierModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();
      } catch (err) {
        alert("Грешка при запазване на досието: " + err.message);
        console.error(err);
      } finally {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    });
  }

});

/**
 * Initialize the dashboard based on user role
 * @param {Object} session - The auth session object
 */
async function initializeDashboard(session) {
  try {
    const userRole = await getUserRole(session.user.id);

    if (!userRole) {
      console.error('Unable to determine user role');
      return;
    }

    // Get section elements
    const servicesSec = document.getElementById('adminServicesSection');
    const usersSec = document.getElementById('adminUsersSection');
    const scheduleSec = document.getElementById('adminScheduleSection');

    if (userRole === 'staff') {
      // Hide the financial dashboard for staff
      const dashboardWrapper = document.getElementById('adminDashboardWrapper');
      if (dashboardWrapper) {
        dashboardWrapper.innerHTML = '';
      }
      
      if (servicesSec) servicesSec.style.display = 'none';
      if (usersSec) usersSec.style.display = 'none';
      if (scheduleSec) scheduleSec.style.display = 'block';
      await loadManualBookingOptions();
      await loadSchedule(session);
    } else if (userRole === 'admin') {
      // Unhide the financial dashboard for admin users only
      const dashboardWrapper = document.getElementById('adminDashboardWrapper');
      if (dashboardWrapper) {
        dashboardWrapper.classList.remove('d-none');
      }
      
      if (servicesSec) servicesSec.style.display = 'block';
      if (usersSec) usersSec.style.display = 'block';
      if (scheduleSec) scheduleSec.style.display = 'block';
      const gallerySec = document.getElementById('adminGallerySection');
      if (gallerySec) gallerySec.style.display = 'block';
      const productsSec = document.getElementById('adminProductsSection');
      if (productsSec) productsSec.style.display = 'block';
      await loadManualBookingOptions();
      await loadSpecialists();
      await loadServices();
      await loadUsers();
      await loadGallery();
      await loadProducts();
      await loadSchedule(session);
      
      // Initialize the dashboard functionality for admins
      if (typeof window.initDashboardControls === 'function') {
        window.initDashboardControls();
      }
      const monthPicker = document.getElementById('dashboardMonthPicker');
      const initialMonth = monthPicker ? monthPicker.value : null;
      await window.loadFinancialDashboard(initialMonth);
      setupServiceFormListener();
      setupGalleryFormListener();
      setupGalleryDeleteListener();
      setupProductFormListener();
      setupProductDeleteListener();
    } else {
      // Client or other role: Should not be here
      console.warn('User role does not have dashboard access');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
}

/**
 * Get user role from profiles table
 * @param {string} userId - The user ID
 * @returns {Promise<string|null>} The user's role or null
 */
async function getUserRole(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data?.role || null;
  } catch (error) {
    console.error('Unexpected error fetching user role:', error);
    return null;
  }
}

/**
 * Initialize dashboard controls (month picker)
 */
window.initDashboardControls = () => {
    const monthPicker = document.getElementById('dashboardMonthPicker');
    if (monthPicker) {
        // Set default to current month
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        if (!monthPicker.value) monthPicker.value = `${year}-${month}`;

        // Listen for changes
        monthPicker.addEventListener('change', (e) => {
            window.loadFinancialDashboard(e.target.value);
        });
    }
};

/**
 * Load financial dashboard with KPI cards and charts
 */
window.loadFinancialDashboard = async (selectedMonthStr) => {
    try {
        const dashboardHeader = document.getElementById('dashboardHeaderSection');
        const dashboard = document.getElementById('financialDashboard');
        if (!dashboardHeader || !dashboard) return;
        
        dashboardHeader.style.display = 'block'; // Show header

        // Determine the date range based on input (YYYY-MM)
        let year, month;
        if (selectedMonthStr) {
            [year, month] = selectedMonthStr.split('-');
        } else {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth() + 1;
        }

        // 1. Bulletproof Date Math
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const startStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        const endStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const targetStart = new Date(startStr);
        const targetEnd = new Date(endStr);
        targetEnd.setHours(23, 59, 59, 999);

        // 2. Fetch ALL necessary relational data
        const { data: bookings, error: bError } = await supabase.from('bookings').select('*');
        const { data: services, error: sError } = await supabase.from('services').select('*');
        const { data: profiles, error: pError } = await supabase.from('profiles').select('id, full_name');

        if (bError || sError || pError) {
            console.error("🔥 DB FETCH ERROR:", { bError, sError, pError });
            throw new Error("Database fetch error");
        }

        // 3. Filter using the correct `appointment_date` column
        const completedBookings = bookings.filter(b => {
            const isCompleted = (b.status || '').trim().toLowerCase() === 'completed';
            if (!b.appointment_date) return false;
            
            const bDate = new Date(b.appointment_date); 
            const isDateInRange = bDate >= targetStart && bDate <= targetEnd;
            
            return isCompleted && isDateInRange;
        });

        console.log("🔥 DASHBOARD FINAL MATCHED BOOKINGS:", completedBookings);

        let totalRevenue = 0;
        const specialistCounts = {};
        const serviceCounts = {};

        // 4. Calculate by resolving IDs
        completedBookings.forEach(booking => {
            // Resolve Service
            const matchedService = services.find(s => s.id === booking.service_id);
            const servName = matchedService && matchedService.name ? matchedService.name : 'Изтрита услуга';
            
            serviceCounts[servName] = (serviceCounts[servName] || 0) + 1;
            
            if (matchedService && matchedService.price) {
                totalRevenue += Number(matchedService.price);
            }

            // Resolve Specialist
            const matchedProfile = profiles.find(p => p.id === booking.employee_id);
            const specName = matchedProfile && matchedProfile.full_name ? matchedProfile.full_name : 'Неизвестен';
            
            specialistCounts[specName] = (specialistCounts[specName] || 0) + 1;
        });

        // 5. Update KPI Cards
        document.getElementById('dashRevenue').innerText = totalRevenue.toFixed(2) + ' лв.';
        
        const topSpecialist = Object.keys(specialistCounts).length > 0 ? Object.keys(specialistCounts).reduce((a, b) => specialistCounts[a] > specialistCounts[b] ? a : b) : '-';
        document.getElementById('dashTopSpecialist').innerText = topSpecialist;

        const topService = Object.keys(serviceCounts).length > 0 ? Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b) : '-';
        document.getElementById('dashTopService').innerText = topService;

        // Render Specialist Pie Chart
        const specCtx = document.getElementById('specialistChart');
        if (specCtx) {
            if (window.specChartInst) window.specChartInst.destroy();
            window.specChartInst = new Chart(specCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(specialistCounts).length > 0 ? Object.keys(specialistCounts) : ['Нема данни'],
                    datasets: [{
                        data: Object.values(specialistCounts).length > 0 ? Object.values(specialistCounts) : [1],
                        backgroundColor: ['#212529', '#0d6efd', '#ffc107', '#198754', '#dc3545'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
            });
        }

        // Render Services Bar Chart (Sort and get top 5)
        const sortedServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const servCtx = document.getElementById('servicesChart');
        if (servCtx) {
            if (window.servChartInst) window.servChartInst.destroy();
            window.servChartInst = new Chart(servCtx, {
                type: 'bar',
                data: {
                    labels: sortedServices.length > 0 ? sortedServices.map(s => s[0]) : ['Нема данни'],
                    datasets: [{
                        label: 'Брой резервации',
                        data: sortedServices.length > 0 ? sortedServices.map(s => s[1]) : [0],
                        backgroundColor: '#0d6efd',
                        borderRadius: 5
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: true, 
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { stepSize: 1 } 
                        } 
                    } 
                }
            });
        }

    } catch (err) {
        console.error("Dashboard error:", err);
    }
};

/**
 * Open the dossier modal for a specific client
 */
window.openDossier = async (clientId, clientName) => {
    if (!clientId) {
        alert("Грешка: Липсва ID на клиента за тази резервация.");
        return;
    }
    
    document.getElementById('dossierClientId').value = clientId;
    document.getElementById('dossierClientName').innerText = clientName;
    const notesArea = document.getElementById('dossierNotes');
    notesArea.value = 'Зареждане...';
    
    // Show the modal
    const dossierModal = new bootstrap.Modal(document.getElementById('dossierModal'));
    dossierModal.show();

    // Fetch existing notes
    try {
        const { data, error } = await supabase
            .from('client_notes')
            .select('notes')
            .eq('client_id', clientId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "Row not found" (which is fine for new clients)

        notesArea.value = data ? data.notes : '';
    } catch (err) {
        console.error("Error fetching dossier:", err);
        notesArea.value = '';
    }
};

/**
 * Load specialists from the database and populate the specialist dropdown
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
      return;
    }

    const specialistSelect = document.getElementById('serviceSpecialist');
    if (!specialistSelect) {
      console.error('Specialist select element not found');
      return;
    }

    // Clear existing options except the default one
    specialistSelect.innerHTML = '<option value="">Изберете специалист...</option>';

    // Add specialists to dropdown
    if (data && data.length > 0) {
      data.forEach(specialist => {
        const option = document.createElement('option');
        option.value = specialist.id;
        option.textContent = specialist.full_name;
        specialistSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Unexpected error loading specialists:', error);
  }
}

/**
 * Load clients and services for the manual booking form
 */
async function loadManualBookingOptions() {
  try {
    // Fetch all users (for client selection)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .order('full_name', { ascending: true });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    // Fetch all services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name')
      .order('name', { ascending: true });

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return;
    }

    // Populate client dropdown
    const clientSelect = document.getElementById('manualClient');
    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">Изберете клиент...</option>';
      if (users && users.length > 0) {
        users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.id;
          option.textContent = `${user.full_name} (${user.phone || 'N/A'})`;
          clientSelect.appendChild(option);
        });
      }
    }

    // Populate service dropdown
    const serviceSelect = document.getElementById('manualService');
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">Изберете услуга...</option>';
      if (services && services.length > 0) {
        services.forEach(service => {
          const option = document.createElement('option');
          option.value = service.id;
          option.textContent = service.name;
          serviceSelect.appendChild(option);
        });
      }
    }

    // Initialize Flatpickr for manual date picker
    initializeFlatpickr();

    // Setup manual booking form listener
    setupManualBookingFormListener();
  } catch (error) {
    console.error('Unexpected error loading manual booking options:', error);
  }
}

/**
 * Initialize Flatpickr for the manual booking date picker
 */
function initializeFlatpickr() {
  const manualDateInput = document.getElementById('manualDate');
  if (manualDateInput && window.flatpickr) {
    flatpickr(manualDateInput, {
      minDate: "today",
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "F j, Y"
    });
  }
}

/**
 * Setup event listener for the manual booking form
 */
function setupManualBookingFormListener() {
  const form = document.getElementById('manualBookingForm');

  if (!form) {
    console.error('Manual booking form not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientVal = document.getElementById('manualClient').value.trim();
    const serviceVal = document.getElementById('manualService').value.trim();
    const dateVal = document.getElementById('manualDate').value.trim();
    const timeVal = document.getElementById('manualTime').value.trim();

    if (!clientVal || !serviceVal || !dateVal || !timeVal) {
      alert('Моля, попълнете всички търсени поле');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Сесия и стартир. Моля, влезте отново.');
        return;
      }

      // Construct the ISO timestamp
      const appointmentDate = new Date(`${dateVal}T${timeVal}`).toISOString();

      // Fetch user role for employee assignment
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      const userRole = profile?.role;

      // Check for existing overlapping bookings
      const employeeIdToBook = userRole === 'staff' ? session.user.id : session.user.id;

      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('id')
        .eq('employee_id', employeeIdToBook)
        .eq('appointment_date', appointmentDate)
        .neq('status', 'cancelled');

      if (checkError) {
        console.error("Error checking existing bookings:", checkError);
        alert("Грешка при проверка на дни работи.");
        return;
      }

      if (existingBookings && existingBookings.length > 0) {
        alert("ОПНа: Праж 8 па бърже, Помеънете друга страница на дня.");
        return;
      }

      // Insert the booking (employee_id is the current logged-in user)
      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            client_id: clientVal,
            employee_id: session.user.id,
            service_id: serviceVal,
            appointment_date: appointmentDate,
            status: 'confirmed'
          }
        ]);

      if (error) {
        console.error('Error adding booking:', error);
        alert('Неуспешно добавяне на резервация');
        return;
      }

      // Hide modal
      const modalElement = document.getElementById('manualBookingModal');
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      }

      alert('Резервация успешно добавена!');

      // Clear form
      form.reset();

      // Reload schedule
      await loadSchedule(session);
    } catch (error) {
      console.error('Unexpected error adding appointment:', error);
      alert('Грешка при добавяне на резервация');
    }
  });
}

/**
 * Load and display schedule with bulletproof rendering
 * Fetches bookings and renders them into the DOM with proper error handling
 * @param {Object} session - The auth session object
 */
async function loadSchedule(session) {
    try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) return;

        // Fetch role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentSession.user.id).single();
        const userRole = profile?.role;

        // Build query with specialist and service joins
        let query = supabase
            .from('bookings')
            .select(`
                id, 
                appointment_date, 
                status, 
                cancelled_by,
                rating,
                feedback_notes,
                services!bookings_service_id_fkey(name),
                specialist:profiles!bookings_employee_id_fkey(full_name),
                client:client_id(*)
            `)
            .order('appointment_date', { ascending: true });

        // Filter for staff
        if (userRole === 'staff') {
            query = query.eq('employee_id', currentSession.user.id);
        }

        const { data: schedule, error } = await query;
        console.log('Fetched schedule array for render:', schedule);

        if (error) {
            console.error('Error fetching schedule:', error);
            return;
        }

        // Transform schedule data to match expected format
        const bookings = (schedule || []).map(booking => {
            const dateObj = new Date(booking.appointment_date);
            const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = dateObj.toTimeString().slice(0, 5); // HH:MM

            return {
                id: booking.id,
                date: dateStr,
                time: timeStr,
                specialist: booking.specialist?.full_name || 'Неугнатен',
                service: booking.services?.name || 'Unknown Service',
                user_email: booking.client?.email || 'Unknown',
                user_id: booking.client?.id || '',
                client_name: booking.client?.full_name || 'Клиент',
                status: booking.status || 'pending',
                cancelled_by: booking.cancelled_by,
                rating: booking.rating,
                feedback_notes: booking.feedback_notes
            };
        });

        // Group bookings by specialist
        const groupedBookings = bookings.reduce((acc, booking) => {
            const specName = booking.specialist || 'Неугнатен';
            if (!acc[specName]) acc[specName] = [];
            acc[specName].push(booking);
            return acc;
        }, {});

        const accordionContainer = document.getElementById('adminScheduleAccordion');
        accordionContainer.innerHTML = '';

        if (Object.keys(groupedBookings).length === 0) {
            accordionContainer.innerHTML = '<div class="p-4 text-center text-muted">No bookings found.</div>';
            return;
        }

        let isFirst = true;

        for (const [specialist, specBookings] of Object.entries(groupedBookings)) {
            const safeId = specialist.replace(/[^a-zA-Z0-9]/g, '') || 'unassigned';
            const collapseId = `collapse-${safeId}`;
            const headingId = `heading-${safeId}`;
            
            // Split bookings into active and past
            const activeBookings = specBookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
            const pastBookings = specBookings.filter(b => b.status === 'completed' || b.status.includes('cancel'));

            // Sort active bookings ascending (closest date first)
            activeBookings.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

            // Sort past bookings descending (most recently finished first)
            pastBookings.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

            // Helper function to generate row HTML
            const generateRowsHTML = (bookingsArray) => {
                if (bookingsArray.length === 0) {
                    return `<tr><td colspan="5" class="text-center text-muted py-3">Няма записи</td></tr>`;
                }

                return bookingsArray.map(booking => {
                    // KEEP EXISTING STATUS LOGIC EXACTLY AS IS
                    let statusBadge = '';
                    if (booking.status === 'confirmed') statusBadge = '<span class="badge bg-success">Потвърден</span>';
                    else if (booking.status === 'completed') statusBadge = '<span class="badge bg-secondary">Приключен</span>';
                    else if (booking.status === 'cancelled') {
                        const canceller = booking.cancelled_by === 'client' ? '(от Клиент)' : '(от Салон)';
                        statusBadge = `<span class="badge bg-danger">Отказан ${canceller}</span>`;
                    } else {
                        statusBadge = `<span class="badge bg-warning text-dark">${booking.status}</span>`;
                    }

                    // KEEP EXISTING ACTION BUTTONS EXACTLY AS IS
                    let actionButtons = '';
                    if (booking.status === 'confirmed' || booking.status === 'pending') {
                        actionButtons = `
                            <button class="btn btn-sm btn-success complete-btn me-1" data-id="${booking.id}">Приключи</button>
                            <button class="btn btn-sm btn-danger admin-cancel-btn me-1" data-id="${booking.id}">Откажи</button>
                            <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="openDossier('${booking.user_id}', '${booking.client_name}')">📝 Досие</button>
                        `;
                    } else {
                        actionButtons = `
                            <span class="text-muted small me-1">Няма действия</span>
                            <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="openDossier('${booking.user_id}', '${booking.client_name}')">📝 Досие</button>
                        `;
                    }

                    const dateObj = new Date(`${booking.date} ${booking.time}`);
                    const formattedDate = dateObj.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

                    // Build feedback HTML - only show to admins
                    let adminFeedbackHTML = '';
                    if (userRole === 'admin' && booking.rating) {
                        adminFeedbackHTML = `
                            <div class="mt-2 p-2 bg-light rounded small border-start border-warning border-3">
                                <strong>Обратна връзка:</strong> ⭐ ${booking.rating}/5 <br>
                                <span class="text-muted">"${booking.feedback_notes || 'Няма коментар'}"</span>
                            </div>
                        `;
                    }

                    return `
                        <tr>
                            <td class="fw-bold">${formattedDate}</td>
                            <td>
                                ${booking.service}
                                ${adminFeedbackHTML}
                            </td>
                            <td>${booking.user_email || 'Неизвестен'}</td>
                            <td>${statusBadge}</td>
                            <td>${actionButtons}</td>
                        </tr>
                    `;
                }).join('');
            };

            const accordionBodyHtml = `
                <div class="accordion-body bg-white p-4">
                    <h6 class="fw-bold text-success mb-3"><i class="bi bi-calendar-check"></i> Предстоящи резервации</h6>
                    <div class="table-responsive mb-4">
                        <table class="table table-hover align-middle shadow-sm border rounded">
                            <thead class="table-light">
                                <tr>
                                    <th>Дата & Час</th>
                                    <th>Услуга</th>
                                    <th>Клиент</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRowsHTML(activeBookings)}
                            </tbody>
                        </table>
                    </div>

                    <h6 class="fw-bold text-secondary mb-3 border-top pt-4"><i class="bi bi-archive"></i> Архив (Приключени и Отказани)</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover align-middle text-muted opacity-75">
                            <thead class="table-light">
                                <tr>
                                    <th>Дата & Час</th>
                                    <th>Услуга</th>
                                    <th>Клиент</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRowsHTML(pastBookings)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Calculate average rating for this specialist
            const ratedBookings = specBookings.filter(b => b.rating && !isNaN(b.rating));
            let averageRatingHtml = '';

            // Check if the user is an admin before generating the badge
            // Note: Ensure you use the correct variable for the user's role (userRole or window.userRole)
            if (typeof userRole !== 'undefined' && userRole === 'admin') {
                if (ratedBookings.length > 0) {
                    const sumRatings = ratedBookings.reduce((sum, curr) => sum + Number(curr.rating), 0);
                    const avgRating = (sumRatings / ratedBookings.length).toFixed(1); 
                    averageRatingHtml = `<span class="badge bg-warning text-dark ms-2 fs-6 shadow-sm">⭐ ${avgRating}/5 <small class="text-muted fw-normal">(${ratedBookings.length} мнения)</small></span>`;
                } else {
                    averageRatingHtml = `<span class="badge bg-light text-secondary ms-2 border">Няма оценки</span>`;
                }
            }

            const accordionItem = `
                <div class="accordion-item border-0 border-bottom">
                    <h2 class="accordion-header" id="${headingId}">
                        <button class="accordion-button ${isFirst ? '' : 'collapsed'} fw-bold fs-5 bg-light text-dark" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isFirst ? 'true' : 'false'}" aria-controls="${collapseId}">
                            💇‍♀️ ${specialist} <span class="badge bg-primary ms-3 rounded-pill">${specBookings.length} bookings</span>${averageRatingHtml}
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse ${isFirst ? 'show' : ''}" aria-labelledby="${headingId}" data-bs-parent="#adminScheduleAccordion">
                        ${accordionBodyHtml}
                    </div>
                </div>
            `;

            accordionContainer.innerHTML += accordionItem;
            isFirst = false; // Only the first accordion stays open by default
        }

        // Attach event listeners for Complete button
        document.addEventListener('click', async (e) => {
            const completeBtn = e.target.closest('.complete-btn');
            
            if (completeBtn) {
                const bookingId = completeBtn.getAttribute('data-id');
                
                const action = 'complete';
                if (action === 'complete' && confirm('Маркирай од мата авторитет като завършена?')) {
                    const originalText = completeBtn.innerHTML;
                    completeBtn.innerHTML = 'Completing...';
                    completeBtn.disabled = true;
                    
                    try {
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'completed' })
                            .eq('id', bookingId);
                        
                        if (error) throw error;
                        
                        alert('Резервация бе отбелязана като приключена!');
                        await loadSchedule({ user: { id: '' } });
                    } catch (error) {
                        console.error('Error completing appointment:', error);
                        alert('Неуспешно отбелязване: ' + error.message);
                        completeBtn.innerHTML = originalText;
                        completeBtn.disabled = false;
                    }
                }
            }
        });

        // Attach event listeners for Admin Cancel button
        document.addEventListener('click', async (e) => {
            const adminCancelBtn = e.target.closest('.admin-cancel-btn');
            
            if (adminCancelBtn) {
                const bookingId = adminCancelBtn.getAttribute('data-id');
                
                if (confirm('Откажи тази резервация?')) {
                    const originalText = adminCancelBtn.innerHTML;
                    adminCancelBtn.innerHTML = 'Отказване...';
                    adminCancelBtn.disabled = true;
                    
                    try {
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'cancelled', cancelled_by: 'admin' })
                            .eq('id', bookingId);
                        
                        if (error) throw error;
                        
                        alert('Резервациюта бе отказана!');
                        await loadSchedule({ user: { id: '' } });
                    } catch (error) {
                        console.error('Error cancelling appointment:', error);
                        alert('Неуспешно отказване: ' + error.message);
                        adminCancelBtn.innerHTML = originalText;
                        adminCancelBtn.disabled = false;
                    }
                }
            }
        });

    } catch (err) {
        console.error('Unexpected error during loadSchedule rendering:', err);
    }
}

/**
 * Load services from the database and populate the table
 */
async function loadServices() {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*, specialist:profiles!services_specialist_id_fkey(full_name)');

    if (error) {
      console.error('Error fetching services:', error);
      return;
    }

    populateServicesTable(services || []);
  } catch (error) {
    console.error('Unexpected error loading services:', error);
  }
}

/**
 * Populate the services table with data
 * @param {Array} services - Array of service objects
 */
function populateServicesTable(services) {
  const tbody = document.getElementById('servicesTableBody');

  if (!tbody) {
    console.error('Services table body not found');
    return;
  }

  tbody.innerHTML = '';

  if (services.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No services found.</td></tr>';
    return;
  }

  services.forEach(service => {
    const specialistName = (service.specialist && service.specialist.full_name) ? service.specialist.full_name : 'Без специалист';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${service.name}</td>
      <td>${service.description}</td>
      <td>$${parseFloat(service.price).toFixed(2)}</td>
      <td>${service.duration_minutes} min</td>
      <td>${specialistName}</td>
      <td>
        <button class="btn btn-sm btn-danger delete-service-btn" data-service-id="${service.id}">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-service-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serviceId = e.target.getAttribute('data-service-id');
      await deleteService(serviceId);
    });
  });
}

/**
 * Setup event listener for the Add Service form
 */
function setupServiceFormListener() {
  const form = document.getElementById('addServiceForm');

  if (!form) {
    console.error('Add Service form not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('serviceName').value.trim();
    const description = document.getElementById('serviceDescription').value.trim();
    const price = parseFloat(document.getElementById('servicePrice').value);
    const duration_minutes = parseInt(document.getElementById('serviceDuration').value);
    const specialist_id = document.getElementById('serviceSpecialist').value.trim() || null;

    if (!name || !description || isNaN(price) || isNaN(duration_minutes)) {
      alert('Моля, попълнете всички полета на нятоко');
      return;
    }

    try {
      const { error } = await supabase
        .from('services')
        .insert([
          {
            name,
            description,
            price,
            duration_minutes,
            specialist_id
          }
        ]);

      if (error) {
        console.error('Error adding service:', error);
        alert('Неуспешно добавяне на услуга');
        return;
      }

      // Clear the form
      form.reset();

      // Reload services
      await loadServices();
      alert('Услуга успешно добавена!');
    } catch (error) {
      console.error('Unexpected error adding service:', error);
      alert('An error occurred while adding the service');
    }
  });
}

/**
 * Delete a service by ID
 * @param {string} serviceId - The service ID to delete
 */
async function deleteService(serviceId) {
  if (!confirm('Are you sure you want to delete this service?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
      return;
    }

    // Reload services
    await loadServices();
    alert('Service deleted successfully!');
  } catch (error) {
    console.error('Unexpected error deleting service:', error);
    alert('An error occurred while deleting the service');
  }
}

/**
 * Load all users and display them in the users table with role management
 */
async function loadUsers() {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    const usersTableBody = document.getElementById('usersTableBody');

    if (!usersTableBody) {
      console.error('Users table body not found');
      return;
    }

    // Clear the table body
    usersTableBody.innerHTML = '';

    if (!users || users.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No users found.</td></tr>';
      return;
    }

    // Loop through users and create table rows
    users.forEach(user => {
      const row = document.createElement('tr');
      const fullName = user.full_name || 'N/A';
      const phone = user.phone || 'N/A';
      const role = user.role || 'client';

      let actionsHtml = `<button class="btn btn-sm btn-success rounded-pill save-role-btn" data-user-id="${user.id}">Save Role</button>`;
      if (user.role === 'staff' || user.role === 'admin') {
        actionsHtml += ` <button class="btn btn-sm btn-outline-primary rounded-pill edit-staff-btn" data-id="${user.id}" data-avatar="${user.avatar_url || ''}" data-bio="${user.bio || ''}" data-services="${user.services_offered || ''}">Edit Details</button>`;
      }

      row.innerHTML = `
        <td>${fullName}</td>
        <td>${phone}</td>
        <td>
          <select class="form-select form-select-sm role-dropdown" data-user-id="${user.id}" data-current-role="${role}">
            <option value="client" ${role === 'client' ? 'selected' : ''}>client</option>
            <option value="staff" ${role === 'staff' ? 'selected' : ''}>staff</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
        </td>
        <td>
          ${actionsHtml}
        </td>
      `;

      usersTableBody.appendChild(row);
    });

    // Add event listeners to all Save Role buttons
    document.querySelectorAll('.save-role-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.getAttribute('data-user-id');
        const dropdown = e.target.closest('tr').querySelector('.role-dropdown');
        const selectedRole = dropdown.value;

        await updateUserRole(userId, selectedRole);
      });
    });

    // Add event listeners to all Edit Details buttons
    document.querySelectorAll('.edit-staff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Handle click on icon inside button if present
        const targetBtn = e.target.closest('.edit-staff-btn'); 
        if (!targetBtn) return;

        const id = targetBtn.getAttribute('data-id');
        const bio = targetBtn.getAttribute('data-bio');
        const services = targetBtn.getAttribute('data-services');

        // Populate the modal fields
        document.getElementById('staffId').value = id;
        document.getElementById('staffBio').value = bio !== 'null' && bio !== 'undefined' ? bio : '';
        document.getElementById('staffServices').value = services !== 'null' && services !== 'undefined' ? services : '';
        document.getElementById('staffAvatarFile').value = ''; // Reset file input

        // Show the modal
        const modalEl = document.getElementById('editStaffModal');
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
      });
    });

    // Setup Edit Staff Form submission
    setupEditStaffFormListener();
  } catch (error) {
    console.error('Unexpected error loading users:', error);
  }
}

/**
 * Update a user's role in the database
 * @param {string} userId - The user ID
 * @param {string} role - The new role value
 */
async function updateUserRole(userId, role) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
      return;
    }

    alert('Role updated successfully!');
  } catch (error) {
    console.error('Unexpected error updating user role:', error);
    alert('An error occurred while updating the user role');
  }
}

/**
 * Setup event listener for the Edit Staff Form
 */
function setupEditStaffFormListener() {
  const editStaffForm = document.getElementById('editStaffForm');
  if (editStaffForm) {
    editStaffForm.onsubmit = async (e) => {
      e.preventDefault();
      console.log("--- 1. Form submit intercepted ---");

      const staffIdVal = document.getElementById('staffId').value;
      const bioVal = document.getElementById('staffBio').value;
      const servicesVal = document.getElementById('staffServices').value;
      const fileInput = document.getElementById('staffAvatarFile');
      const file = fileInput.files[0];
      const submitBtn = e.target.querySelector('button[type="submit"]');

      console.log("2. Data gathered. Staff ID:", staffIdVal, "| File:", file ? file.name : "None");

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Uploading... Please wait';
      submitBtn.disabled = true;

      try {
        const staffBtn = document.querySelector(`.edit-staff-btn[data-id="${staffIdVal}"]`);
        let avatarUrl = staffBtn ? staffBtn.getAttribute('data-avatar') : '';
        console.log("3. Existing avatar URL:", avatarUrl);

        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${staffIdVal}-${Date.now()}.${fileExt}`;
          console.log("4. Starting upload to Supabase bucket 'avatars' as:", fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file);
            
          console.log("5. Upload response:", { uploadData, uploadError });

          if (uploadError) throw new Error("Supabase Upload failed: " + uploadError.message);

          console.log("6. Requesting public URL...");
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
          console.log("7. Public URL obtained:", avatarUrl);
        }

        console.log("8. Updating 'profiles' table in database...");
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl, bio: bioVal, services_offered: servicesVal }).eq('id', staffIdVal);
        
        console.log("9. Database update error status:", updateError);
        if (updateError) throw updateError;

        console.log("10. Everything successful. Closing modal...");
        
        // Safe modal hide
        const modalEl = document.getElementById('editStaffModal');
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.hide();
        
        alert('Staff details updated successfully!');
        editStaffForm.reset();
        await loadUsers();

      } catch (error) {
        console.error('CRITICAL ERROR CAUGHT:', error);
        alert("Error: " + error.message);
      } finally {
        console.log("11. Restoring button state");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }
}
/**
 * Load gallery images from the database and render them
 */
async function loadGallery() {
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching gallery:', error);
      return;
    }

    const galleryListContainer = document.getElementById('adminGalleryList');
    if (!galleryListContainer) return;

    galleryListContainer.innerHTML = '';

    data.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card shadow-sm border-0 position-relative">
          <img src="${item.image_url}" alt="${item.title || 'Gallery Image'}" class="card-img-top" style="height: 250px; object-fit: cover;">
          <div class="card-body">
            <p class="card-text text-muted small">${item.title || 'Untitled'}</p>
          </div>
          <button class="btn btn-sm btn-danger delete-gallery-btn position-absolute top-0 end-0 m-2" data-id="${item.id}" data-url="${item.image_url}">Delete</button>
        </div>
      `;
      galleryListContainer.appendChild(col);
    });
  } catch (error) {
    console.error('Unexpected error loading gallery:', error);
  }
}

/**
 * Setup event listener for the gallery upload form (Bulletproof version)
 */
function setupGalleryFormListener() {
  const galleryFileInput = document.getElementById('galleryImageFile');
  // Find the parent form, or fallback to the nearest button if not in a form
  const galleryUploadForm = galleryFileInput ? galleryFileInput.closest('form') : null;
  const galleryUploadBtn = galleryUploadForm ? galleryUploadForm.querySelector('button[type="submit"]') : (galleryFileInput ? galleryFileInput.parentElement.querySelector('button') : null);

  const handleGalleryUpload = async (e) => {
    if (e) e.preventDefault(); // CRITICAL: Prevent page reload!

    if (!galleryFileInput || !galleryFileInput.files[0]) {
      alert('Please select an image to upload.');
      return;
    }

    const file = galleryFileInput.files[0];
    const titleInput = document.getElementById('galleryImageTitle');
    const title = titleInput ? titleInput.value : '';

    const originalBtnText = galleryUploadBtn.innerHTML;
    galleryUploadBtn.innerHTML = 'Uploading... Please wait';
    galleryUploadBtn.disabled = true;

    try {
      // 1. Upload to Supabase Storage ('gallery' bucket)
      const fileExt = file.name.split('.').pop();
      const fileName = `gallery-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Storage Upload failed: " + uploadError.message);

      // 2. Get the Public URL
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      // 3. Save to 'gallery' Database Table
      const { error: dbError } = await supabase
        .from('gallery')
        .insert([{ image_url: imageUrl, title: title }]);

      if (dbError) throw new Error("Database insert failed: " + dbError.message);

      alert('Image added to gallery successfully!');

      // Reset input fields
      galleryFileInput.value = '';
      if (titleInput) titleInput.value = '';

      // Refresh the admin gallery view
      if (typeof loadGallery === 'function') {
        await loadGallery();
      }

    } catch (error) {
      console.error('Gallery upload error:', error);
      alert(error.message);
    } finally {
      galleryUploadBtn.innerHTML = originalBtnText;
      galleryUploadBtn.disabled = false;
    }
  };

  // Safely attach the event listener depending on HTML structure
  if (galleryUploadForm) {
    galleryUploadForm.onsubmit = handleGalleryUpload;
  } else if (galleryUploadBtn) {
    galleryUploadBtn.onclick = handleGalleryUpload;
  }
}

/**
 * Setup event delegation for deleting gallery images
 */
function setupGalleryDeleteListener() {
  const galleryListContainer = document.getElementById('adminGalleryList');
  if (!galleryListContainer) return;

  galleryListContainer.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-gallery-btn');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    const imageUrl = deleteBtn.dataset.url;

    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      // Extract filename from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('gallery')
        .remove([fileName]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage delete fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('gallery')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        alert('Failed to delete gallery record');
        return;
      }

      alert('Image deleted successfully!');
      await loadGallery();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error: ' + error.message);
    }
  });
}

/**
 * Load products from the database and render them
 */
async function loadProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    const productsListContainer = document.getElementById('adminProductsList');
    if (!productsListContainer) return;

    productsListContainer.innerHTML = '';

    data.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card shadow-sm border-0 position-relative">
          <img src="${item.image_url}" alt="${item.name || 'Product'}" class="card-img-top" style="height: 250px; object-fit: cover;">
          <div class="card-body">
            <h5 class="card-title fw-bold">${item.name}</h5>
            <p class="card-text text-muted small">${item.description || ''}</p>
          </div>
          <button class="btn btn-sm btn-danger delete-product-btn position-absolute top-0 end-0 m-2" data-id="${item.id}" data-url="${item.image_url}">Delete</button>
        </div>
      `;
      productsListContainer.appendChild(col);
    });
  } catch (error) {
    console.error('Unexpected error loading products:', error);
  }
}

/**
 * Setup event listener for the product upload form (Bulletproof version)
 */
function setupProductFormListener() {
  const productFileInput = document.getElementById('productImageFile');
  const productUploadForm = productFileInput ? productFileInput.closest('form') : null;
  const productUploadBtn = productUploadForm ? productUploadForm.querySelector('button[type="submit"]') : (productFileInput ? productFileInput.parentElement.querySelector('button') : null);

  const handleProductUpload = async (e) => {
    if (e) e.preventDefault(); // CRITICAL: Prevent page reload!

    if (!productFileInput || !productFileInput.files[0]) {
      alert('Please select an image for the product.');
      return;
    }

    const file = productFileInput.files[0];
    const nameInput = document.getElementById('productName');
    const descInput = document.getElementById('productDescription');

    const name = nameInput ? nameInput.value : '';
    const desc = descInput ? descInput.value : '';

    if (!name) {
      alert('Please enter a product name.');
      return;
    }

    const originalBtnText = productUploadBtn.innerHTML;
    productUploadBtn.innerHTML = 'Uploading... Please wait';
    productUploadBtn.disabled = true;

    try {
      // 1. Upload to Supabase Storage ('products' bucket)
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Storage Upload failed: " + uploadError.message);

      // 2. Get the Public URL
      const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      // 3. Save to 'products' Database Table
      const { error: dbError } = await supabase
        .from('products')
        .insert([{ image_url: imageUrl, name: name, description: desc }]);

      if (dbError) throw new Error("Database insert failed: " + dbError.message);

      alert('Product added successfully!');
      
      // Reset fields
      if (productUploadForm) productUploadForm.reset();
      else {
        productFileInput.value = '';
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
      }
      
      // Refresh the admin products view
      if (typeof loadProducts === 'function') {
        await loadProducts();
      }

    } catch (error) {
      console.error('Product upload error:', error);
      alert(error.message);
    } finally {
      productUploadBtn.innerHTML = originalBtnText;
      productUploadBtn.disabled = false;
    }
  };

  // Safely attach the event listener
  if (productUploadForm) {
    productUploadForm.onsubmit = handleProductUpload;
  } else if (productUploadBtn) {
    productUploadBtn.onclick = handleProductUpload;
  }
}

/**
 * Setup event delegation for deleting products
 */
function setupProductDeleteListener() {
  const productsListContainer = document.getElementById('adminProductsList');
  if (!productsListContainer) return;

  productsListContainer.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-product-btn');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    const imageUrl = deleteBtn.dataset.url;

    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      // Extract filename from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('products')
        .remove([fileName]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage delete fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        alert('Failed to delete product record');
        return;
      }

      alert('Product deleted successfully!');
      await loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error: ' + error.message);
    }
  });
}

