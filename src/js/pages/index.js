import { supabase } from '../services/supabaseClient.js';

/**
 * Initialize home page
 * Load and display services
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load team members when team modal is shown
        const teamModal = document.getElementById('teamModal');
        if (teamModal) {
            teamModal.addEventListener('show.bs.modal', loadTeamMembers);
        }
        
        // Load services when services modal is shown
        const servicesModal = document.getElementById('servicesModal');
        if (servicesModal) {
            servicesModal.addEventListener('show.bs.modal', loadServices);
        }

        // Load products when products modal is shown
        const productsModal = document.getElementById('productsModal');
        if (productsModal) {
            productsModal.addEventListener('show.bs.modal', loadPremiumProducts);
        }
    } catch (error) {
        console.error('Error initializing home page:', error);
        showMessage('Грешка при зареждане на данни. Моля, обновете страницата.', 'danger');
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

        const servicesContainer = document.getElementById('servicesModalList');
        
        if (!services || services.length === 0) {
            servicesContainer.innerHTML = '<p class="text-center text-muted">No services available at the moment.</p>';
            return;
        }

        // Clear existing content
        servicesContainer.innerHTML = '';

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
                            <small class="text-muted"><i class="bi bi-clock"></i> ${service.duration_minutes} mins</small>
                            <a href="booking.html" class="btn btn-outline-primary btn-sm rounded-pill px-3">Book Now</a>
                        </div>
                    </div>
                </div>
            `;
            servicesContainer.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading services:', error);
        showMessage('Грешка при зареждане на услуги. Моля, опитайте отново.', 'danger');
    }
}

/**
 * Load team members from database
 */
async function loadTeamMembers() {
    const container = document.getElementById('teamMembersContainer');
    if (!container) return;
    
    const { data: staff, error } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']);
    if (error || !staff) {
        container.innerHTML = '<p class="text-center text-danger">Could not load team members.</p>';
        return;
    }
    
    container.innerHTML = '';
    staff.forEach(member => {
        const avatar = member.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.full_name) + '&background=random&size=150';
        const bio = member.bio || 'Professional beauty specialist ready to take care of you.';
        
        container.innerHTML += `
        <div class="col-md-6 text-center">
            <div class="bg-white p-4 rounded-4 shadow-sm h-100">
                <img src="${avatar}" alt="${member.full_name}" class="rounded-circle mb-3 shadow" style="width: 150px; height: 150px; object-fit: cover; border: 4px solid #fff;">
                <h4 class="fw-bold mb-1">${member.full_name}</h4>
                <p class="text-muted small">${bio}</p>
            </div>
        </div>`;
    });
}

/**
 * Load premium products from database
 */
async function loadPremiumProducts() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const productsContainer = document.getElementById('productsModalList');
        
        if (!products || products.length === 0) {
            productsContainer.innerHTML = '<p class="text-center text-muted">No premium products available at the moment.</p>';
            return;
        }

        // Clear existing content
        productsContainer.innerHTML = '';

        // Render each product as a card
        products.forEach(product => {
            const col = document.createElement('div');
            col.className = 'col-md-6';
            col.innerHTML = `
                <div class="bg-white p-4 rounded-4 shadow-sm h-100 text-center">
                    <img src="${product.image_url}" alt="${product.name}" class="img-fluid rounded mb-3" style="max-height: 150px; object-fit: contain;">
                    <h4 class="fw-bold mb-2">${product.name}</h4>
                    <p class="text-muted small mb-0">${product.description || ''}</p>
                </div>
            `;
            productsContainer.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsModalList').innerHTML = '<p class="text-center text-danger">Error loading products. Please try again later.</p>';
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
