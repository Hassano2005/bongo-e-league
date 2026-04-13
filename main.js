// ─── DYNAMIC API CONFIGURATION ───
// This automatically proxies '/api/...' calls to your backend when hosted separately (e.g. Netlify -> Render)
window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '' 
    : 'https://bongo-eleague-backend.onrender.com'; // <--- CHANGE THIS TO YOUR ACTUAL BACKEND URL ON DEPLOYMENT

const originalFetch = window.fetch;
window.fetch = async function() {
    let args = arguments;
    if (typeof args[0] === 'string' && args[0].startsWith('/api/')) {
        args[0] = window.API_BASE_URL + args[0];
    }
    return originalFetch.apply(this, args);
};

// ─── SHARED NAVIGATION SCRIPT ───
document.addEventListener('DOMContentLoaded', () => {

    // Set active nav link based on current page
    const links = document.querySelectorAll('.nav-links a');
    const currentPage = window.location.pathname.split('/').pop() || 'home.html';
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Mobile hamburger menu toggle
    const hamburger = document.getElementById('navHamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
        // Close on link click
        navLinks.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => navLinks.classList.remove('open'));
        });
    }

    // Toast notification system
    window.showToast = function(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    };

    function createToastContainer() {
        const tc = document.createElement('div');
        tc.id = 'toastContainer';
        tc.className = 'toast-container';
        document.body.appendChild(tc);
        return tc;
    }

    // Modal open/close utility
    window.openModal = function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    };

    window.closeModal = function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    };

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // Animated number counter
    window.animateCount = function(el, target, duration = 1500) {
        const start = 0;
        const step = (target / (duration / 16));
        let current = start;
        const update = () => {
            current = Math.min(current + step, target);
            el.textContent = Math.floor(current).toLocaleString();
            if (current < target) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    };

    // Tab switching utility
    window.initTabs = function(tabSelector, panelSelector) {
        const tabs = document.querySelectorAll(tabSelector);
        const panels = document.querySelectorAll(panelSelector);
        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => { p.style.display = 'none'; });
                tab.classList.add('active');
                if (panels[i]) panels[i].style.display = 'block';
            });
        });
    };

    // Intersection Observer for animate-in
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.observe-animate').forEach(el => observer.observe(el));

    // --- AUTHENTICATION NAVBAR INJECTION ---
    const token = localStorage.getItem('league_token');
    const navActions = document.querySelector('.nav-actions');
    
    // Only inject if navActions exists
    if (navActions) {
        if (token) {
            // Find if there's an existing login link in sidebars/heroes we should hide/convert
            const existingLogins = document.querySelectorAll('a[href="index.html"]');
            existingLogins.forEach(el => {
                if(el.textContent.includes('Login') || el.textContent.includes('Logout')) {
                    el.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                    el.onclick = (e) => { e.preventDefault(); logout(); };
                }
            });
            
            // Add a small logout button next to avatar
            if (!document.getElementById('navLogoutBtn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'navLogoutBtn';
                logoutBtn.className = 'btn btn-ghost btn-sm';
                logoutBtn.style.padding = '0.3rem 0.6rem';
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                logoutBtn.title = 'Logout';
                logoutBtn.onclick = () => window.logout();
                
                // Insert right before hamburger
                const hamburger = document.getElementById('navHamburger');
                if (hamburger) navActions.insertBefore(logoutBtn, hamburger);
                else navActions.appendChild(logoutBtn);
            }
        } else {
            // Not logged in: Change profile/avatar stuff to Login
            const avatar = document.querySelector('.nav-avatar');
            if(avatar) {
                avatar.onclick = () => window.location.href = 'index.html';
                avatar.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
                avatar.title = 'Login';
            }
        }
    }

    window.logout = function() {
        localStorage.removeItem('league_token');
        showToast('Logged out successfully', 'info');
        setTimeout(() => window.location.href = 'home.html', 1000);
    };
});
