# Project: Beauty Studio Bony

## App Context
A beauty salon website featuring a home page, gallery, booking calendar, user registration, and an admin panel. 

## Technology Stack (STRICT)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap.
- **Backend/BaaS:** Supabase (Database, Authentication, Storage) via REST API/Supabase JS Client.
- **Build Tools:** Node.js, npm, Vite.
- **STRICT PROHIBITIONS:** DO NOT use TypeScript. DO NOT use UI frameworks like React, Vue, Angular, or Svelte. DO NOT build a Single Page Application (SPA).

## Architectural Guidelines
1. **Multi-Page Architecture (MPA):** Use native multi-page navigation. Each page (e.g., `index.html`, `gallery.html`, `login.html`, `booking.html`, `admin.html`) must be a separate HTML file. NO pop-ups for main navigation.
2. **Modular Design:** Keep the codebase modular. Separate files for UI (HTML), styles (CSS), business logic/services (JS), and utilities. 
3. **Client-Server Communication:** The frontend communicates directly with the Supabase backend.
4. **Clean Code:** Avoid large, monolithic files. Split JS code into focused modules (e.g., `authService.js`, `bookingService.js`, `utils.js`).