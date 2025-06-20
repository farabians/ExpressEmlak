// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const nav = document.querySelector('.nav');
const header = document.querySelector('.header');
const propertyCards = document.querySelectorAll('.property-card');
const serviceCards = document.querySelectorAll('.service-card');
const favoriteIcons = document.querySelectorAll('.property-favorite');

// Tab Switching Functionality
function initTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all tabs
            tabBtns.forEach(tab => tab.classList.remove('active'));
            // Add active class to clicked tab
            btn.classList.add('active');
            
            // Update title based on selected tab
            const tabType = btn.dataset.tab;
            
            if (tabType === 'satilik') {
                document.querySelector('.hero-title').innerHTML = 
                    'Konya\'nın En <span class="highlight">Güvenilir</span> Emlak Ofisi';
            } else {
                document.querySelector('.hero-title').innerHTML = 
                    'Konya\'nın En <span class="highlight">Güvenilir</span> Emlak Ofisi';
            }
        });
    });
}

// Mobile Menu Toggle
function initMobileMenu() {
    if (mobileMenuBtn && nav) {
        mobileMenuBtn.addEventListener('click', () => {
            nav.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
            
            // Toggle hamburger icon
            const icon = mobileMenuBtn.querySelector('i');
            if (nav.classList.contains('active')) {
                icon.classList.replace('fa-bars', 'fa-times');
            } else {
                icon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }
}

// Header Scroll Effect
function initHeaderScroll() {
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                header.style.background = 'rgba(26, 26, 26, 0.98)';
                header.style.backdropFilter = 'blur(15px)';
            } else {
                header.style.background = 'rgba(26, 26, 26, 0.95)';
                header.style.backdropFilter = 'blur(10px)';
            }
        });
    }
}

// Property Card Animations
function initPropertyAnimations() {
    propertyCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in');
    });
}

// Service Card Animations
function initServiceAnimations() {
    serviceCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.15}s`;
        card.classList.add('slide-in-left');
    });
}

// Favorite Icon Toggle
function initFavorites() {
    favoriteIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            const heartIcon = icon.querySelector('i');
            
            if (heartIcon.classList.contains('far')) {
                heartIcon.classList.replace('far', 'fas');
                icon.style.background = '#E5A946';
                icon.style.color = '#fff';
                
                // Add pulse animation
                icon.style.animation = 'pulse 0.3s ease';
                setTimeout(() => {
                    icon.style.animation = '';
                }, 300);
            } else {
                heartIcon.classList.replace('fas', 'far');
                icon.style.background = 'rgba(255,255,255,0.9)';
                icon.style.color = '#333';
            }
        });
    });
}

// Search Form Functionality
function initSearchForm() {
    const searchBtn = document.getElementById('search-properties');
    const districtSelect = document.getElementById('district-select');
    const propertyTypeSelect = document.getElementById('property-type-select');
    const priceRangeSelect = document.getElementById('price-range-select');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Collect form data
            const formData = {
                type: document.querySelector('.tab-btn.active').dataset.tab,
                city: 'konya', // Fixed to Konya
                district: districtSelect.value,
                propertyType: propertyTypeSelect.value,
                priceRange: priceRangeSelect.value
            };
            
            // Show loading state
            const originalText = searchBtn.innerHTML;
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aranıyor...';
            searchBtn.disabled = true;
            
            // Build search URL parameters
            const searchParams = new URLSearchParams();
            if (formData.district) searchParams.append('district', formData.district);
            if (formData.propertyType) searchParams.append('type', formData.propertyType);
            if (formData.priceRange) searchParams.append('price', formData.priceRange);
            searchParams.append('category', formData.type);
            
            // Simulate search with redirect to listings page
            setTimeout(() => {
                searchBtn.innerHTML = originalText;
                searchBtn.disabled = false;
                
                // Redirect to listings page with search parameters
                const searchUrl = `ilanlar.html?${searchParams.toString()}`;
                window.location.href = searchUrl;
            }, 1500);
        });
    }
    
    // Add change event listeners for dynamic updates
    [districtSelect, propertyTypeSelect, priceRangeSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', updateSearchSummary);
        }
    });
}

// Update search summary display
function updateSearchSummary() {
    const activeTab = document.querySelector('.tab-btn.active');
    const district = document.getElementById('district-select').value;
    const propertyType = document.getElementById('property-type-select').value;
    const priceRange = document.getElementById('price-range-select').value;
    
    let summary = `Konya`;
    if (district) summary += ` ${district.charAt(0).toUpperCase() + district.slice(1)}`;
    if (propertyType) summary += ` ${propertyType}`;
    if (activeTab) summary += ` ${activeTab.textContent}`;
    
    // You can use this summary to update UI elements
    console.log('Arama özeti:', summary);
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            margin-left: auto;
        `;
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Intersection Observer for Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements
    const animatedElements = document.querySelectorAll('.service-card, .property-card, .stat-item');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Counter Animation for Stats
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const animateCounter = (element) => {
        const target = parseInt(element.textContent.replace(/\D/g, ''));
        const increment = target / 100;
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format number
            let displayValue = Math.floor(current);
            if (element.textContent.includes('+')) {
                displayValue += '+';
            }
            if (element.textContent.includes('%')) {
                displayValue += '%';
            }
            
            element.textContent = displayValue;
        }, 20);
    };
    
    // Observe stats section
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                statNumbers.forEach(stat => {
                    animateCounter(stat);
                });
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }
}

// Smooth Scrolling for Navigation Links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed header
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Property Image Lazy Loading
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => {
        imageObserver.observe(img);
    });
}

// Search Filter Enhancement (Disabled for main page - using static Konya districts)
function initSearchFilters() {
    // Ana sayfa için statik Konya ilçeleri kullanıldığından bu fonksiyon devre dışı
    // This function is disabled for the main page as we use static Konya districts
    return;
}

// Initialize all functions when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initMobileMenu();
    initHeaderScroll();
    initPropertyAnimations();
    initServiceAnimations();
    initFavorites();
    initSearchForm();
    initScrollAnimations();
    initStatsCounter();
    initSmoothScrolling();
    initLazyLoading();
    initSearchFilters();
    
    // Show welcome message
    setTimeout(() => {
        showNotification('Express Emlak\'a hoş geldiniz! 🏠', 'success');
    }, 1000);
});

// Handle window resize
window.addEventListener('resize', () => {
    // Close mobile menu on resize
    if (window.innerWidth > 768) {
        nav.classList.remove('active');
        mobileMenuBtn.classList.remove('active');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.classList.replace('fa-times', 'fa-bars');
        }
    }
});

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .nav.active {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(26, 26, 26, 0.98);
        padding: 1rem;
        backdrop-filter: blur(15px);
        border-radius: 0 0 15px 15px;
    }
    
    .lazy {
        filter: blur(5px);
        transition: filter 0.3s;
    }
`;

document.head.appendChild(style);