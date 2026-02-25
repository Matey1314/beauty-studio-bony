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
      if (servicesSec) servicesSec.style.display = 'none';
      if (usersSec) usersSec.style.display = 'none';
      if (scheduleSec) scheduleSec.style.display = 'block';
      await loadManualBookingOptions();
      await loadSchedule(session);
    } else if (userRole === 'admin') {
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
    specialistSelect.innerHTML = '<option value="">Select Specialist...</option>';

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
      clientSelect.innerHTML = '<option value="">Select Client...</option>';
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
      serviceSelect.innerHTML = '<option value="">Select Service...</option>';
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
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Session expired. Please log in again.');
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
        alert("An error occurred while checking availability.");
        return;
      }

      if (existingBookings && existingBookings.length > 0) {
        alert("Warning: This time slot is already booked or blocked! Please select another time.");
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
        alert('Failed to add appointment');
        return;
      }

      // Hide modal
      const modalElement = document.getElementById('manualBookingModal');
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      }

      alert('Appointment added successfully!');

      // Clear form
      form.reset();

      // Reload schedule
      await loadSchedule(session);
    } catch (error) {
      console.error('Unexpected error adding appointment:', error);
      alert('An error occurred while adding the appointment');
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

        // Build query (Trying standard foreign key for the client)
        let query = supabase
            .from('bookings')
            .select('id, appointment_date, status, cancelled_by, services(name), client:profiles!bookings_client_id_fkey(full_name, phone)')
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

        const tbody = document.getElementById('scheduleTableBody');
        if (!tbody) {
            console.error('CRITICAL: scheduleTableBody element is missing in admin.html!');
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        if (!schedule || schedule.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No appointments found.</td></tr>';
            return;
        }

        // Render rows safely
        schedule.forEach(booking => {
            const dateObj = new Date(booking.appointment_date);
            const formattedDate = isNaN(dateObj) ? 'Invalid Date' : dateObj.toLocaleString();
            
            // Safely extract names in case the join alias differs
            const clientName = booking.client?.full_name || booking.profiles?.full_name || 'N/A';
            const clientPhone = booking.client?.phone || booking.profiles?.phone || 'N/A';
            const serviceName = booking.services?.name || 'N/A';
            const status = booking.status || 'pending';

            // Generate status badge with cancellation info
            let statusBadge = '';
            if (booking.status === 'confirmed') {
                statusBadge = '<span class="badge bg-success">Confirmed</span>';
            } else if (booking.status === 'completed') {
                statusBadge = '<span class="badge bg-secondary">Completed</span>';
            } else if (booking.status === 'cancelled') {
                const canceller = booking.cancelled_by === 'client' ? '(by Client)' : '(by Salon)';
                statusBadge = `<span class="badge bg-danger">Cancelled ${canceller}</span>`;
            } else {
                statusBadge = `<span class="badge bg-warning text-dark">${booking.status}</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${clientName}</td>
                <td>${clientPhone}</td>
                <td>${serviceName}</td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <button class="btn btn-sm btn-success complete-btn" data-id="${booking.id}">Complete</button>
                    <button class="btn btn-sm btn-danger admin-cancel-btn" data-id="${booking.id}">Cancel</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach event listeners for Complete button
        document.addEventListener('click', async (e) => {
            const completeBtn = e.target.closest('.complete-btn');
            
            if (completeBtn) {
                const bookingId = completeBtn.getAttribute('data-id');
                
                if (confirm('Mark this appointment as completed?')) {
                    const originalText = completeBtn.innerHTML;
                    completeBtn.innerHTML = 'Completing...';
                    completeBtn.disabled = true;
                    
                    try {
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'completed' })
                            .eq('id', bookingId);
                        
                        if (error) throw error;
                        
                        alert('Appointment marked as completed!');
                        await loadSchedule({ user: { id: '' } });
                    } catch (error) {
                        console.error('Error completing appointment:', error);
                        alert('Failed to complete appointment: ' + error.message);
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
                
                if (confirm('Cancel this appointment?')) {
                    const originalText = adminCancelBtn.innerHTML;
                    adminCancelBtn.innerHTML = 'Cancelling...';
                    adminCancelBtn.disabled = true;
                    
                    try {
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'cancelled', cancelled_by: 'admin' })
                            .eq('id', bookingId);
                        
                        if (error) throw error;
                        
                        alert('Appointment cancelled!');
                        await loadSchedule({ user: { id: '' } });
                    } catch (error) {
                        console.error('Error cancelling appointment:', error);
                        alert('Failed to cancel appointment: ' + error.message);
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
      alert('Please fill in all required fields correctly');
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
        alert('Failed to add service');
        return;
      }

      // Clear the form
      form.reset();

      // Reload services
      await loadServices();
      alert('Service added successfully!');
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
        actionsHtml += ` <button class="btn btn-sm btn-outline-primary rounded-pill edit-staff-btn" data-id="${user.id}" data-avatar="${user.avatar_url || ''}" data-bio="${user.bio || ''}">Edit Details</button>`;
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

        // Populate the modal fields
        document.getElementById('staffId').value = id;
        document.getElementById('staffBio').value = bio !== 'null' && bio !== 'undefined' ? bio : '';
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
    editStaffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("--- 1. Form submit intercepted ---");

      const staffIdVal = document.getElementById('staffId').value;
      const bioVal = document.getElementById('staffBio').value;
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
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl, bio: bioVal }).eq('id', staffIdVal);
        
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