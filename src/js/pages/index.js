import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize home page
 * Load and display services
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadServices();
    } catch (error) {
        console.error('Error initializing home page:', error);
        showMessage('Error loading services. Please refresh the page.', 'danger');
    }
});

/**
 * Load services from database
 */
async function loadServices() {
    try {
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        const servicesList = document.getElementById('servicesList');
        
        if (!services || services.length === 0) {
            servicesList.innerHTML = '<p class="text-center text-muted">No services available at the moment.</p>';
            return;
        }

        // Clear existing content
        servicesList.innerHTML = '';

        // Render each service as a premium card
        services.forEach(service => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            col.innerHTML = `
                <div class="card h-100 shadow-sm border-0 rounded-4 hover-shadow transition-all">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold mb-0">${service.name}</h5>
                            <span class="badge bg-primary rounded-pill fs-6 px-3 py-2 shadow-sm">${service.price} lv.</span>
                        </div>
                        <p class="card-text text-muted flex-grow-1">${service.description || 'Professional beauty treatment.'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                            <small class="text-muted"><i class="bi bi-clock"></i> ${service.duration} mins</small>
                            <a href="booking.html" class="btn btn-outline-primary btn-sm rounded-pill px-3">Book Now</a>
                        </div>
                    </div>
                </div>
            `;
            servicesList.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading services:', error);
        showMessage('Error loading services. Please try again later.', 'danger');
    }
}

/**
 * Show a message on the page
 */
function showMessage(message, type) {
    const servicesList = document.getElementById('servicesList');
    servicesList.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}
