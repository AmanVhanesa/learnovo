// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Dashboard Tab Functionality
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Show corresponding content
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background change on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Google Login Functionality
function initializeGoogleLogin() {
    // Load Google Identity Services
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with actual client ID
            callback: handleGoogleLogin
        });
    }
}

function handleGoogleLogin(response) {
    try {
        const responsePayload = decodeJwtResponse(response.credential);
        console.log('Google Login Response:', responsePayload);
        
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify({
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture,
            loginMethod: 'google'
        }));
        
        // Update UI to show logged in state
        updateLoginUI(responsePayload.name, responsePayload.picture);
        
        // Show success message
        showNotification('Successfully logged in with Google!', 'success');
        
    } catch (error) {
        console.error('Google login error:', error);
        showNotification('Google login failed. Please try again.', 'error');
    }
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function updateLoginUI(name, picture) {
    const navButtons = document.querySelector('.nav-buttons');
    if (navButtons) {
        navButtons.innerHTML = `
            <div class="user-profile">
                <img src="${picture}" alt="${name}" class="user-avatar">
                <span class="user-name">${name}</span>
                <button class="btn-secondary" onclick="logout()">Logout</button>
            </div>
        `;
    }
}

function logout() {
    localStorage.removeItem('user');
    location.reload();
}

// Contact form handling
const contactForm = document.querySelector('.contact-form form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data
        const name = contactForm.querySelector('input[type="text"]').value;
        const email = contactForm.querySelector('input[type="email"]').value;
        const phone = contactForm.querySelector('input[type="tel"]').value;
        const message = contactForm.querySelector('textarea').value;
        
        // Enhanced validation
        if (!name || !email || !message) {
            showNotification('Please fill in all required fields.', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }
        
        // Simulate form submission
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            // Store contact data (in real app, send to server)
            const contactData = {
                name, email, phone, message,
                timestamp: new Date().toISOString()
            };
            
            // Store in localStorage for demo
            let contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
            contacts.push(contactData);
            localStorage.setItem('contacts', JSON.stringify(contacts));
            
            showNotification('Thank you for your message! We will get back to you soon.', 'success');
            contactForm.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    });
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('loading');
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .benefit-item, .testimonial-card, .pricing-card').forEach(el => {
    observer.observe(el);
});

// Counter animation for pricing
const animateCounter = (element, target, duration = 2000) => {
    let start = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        start += increment;
        element.textContent = Math.floor(start);
        
        if (start >= target) {
            element.textContent = target;
            clearInterval(timer);
        }
    }, 16);
};

// Animate counters when pricing section is visible
const pricingObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const priceElements = entry.target.querySelectorAll('.amount');
            priceElements.forEach(el => {
                const target = parseInt(el.textContent);
                if (target > 0) {
                    animateCounter(el, target);
                }
            });
            pricingObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const pricingSection = document.querySelector('.pricing');
if (pricingSection) {
    pricingObserver.observe(pricingSection);
}

// Pricing button functionality
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loading');
    
    // Add click handlers to all pricing buttons
    const pricingButtons = document.querySelectorAll('.pricing-card button');
    pricingButtons.forEach(button => {
        button.addEventListener('click', handlePricingClick);
    });
    
    // Add click handlers to hero buttons
    const heroButtons = document.querySelectorAll('.hero-buttons button');
    heroButtons.forEach(button => {
        button.addEventListener('click', handleHeroButtonClick);
    });
    
    // Add click handlers to nav buttons
    const navButtons = document.querySelectorAll('.nav-buttons button');
    navButtons.forEach(button => {
        button.addEventListener('click', handleNavButtonClick);
    });
    
    // Check if user is already logged in
    checkLoginStatus();
    
    // Initialize Google Login
    initializeGoogleLogin();
});

function handlePricingClick(e) {
    const button = e.target;
    const planName = button.closest('.pricing-card').querySelector('h3').textContent;
    
    if (button.textContent.includes('Free Trial')) {
        showTrialModal(planName);
    } else if (button.textContent.includes('Get Started')) {
        showSignupModal(planName);
    } else if (button.textContent.includes('Contact Sales')) {
        showContactModal(planName);
    }
}

function handleHeroButtonClick(e) {
    const button = e.target;
    
    if (button.textContent.includes('Get Started')) {
        showSignupModal('Standard Plan');
    } else if (button.textContent.includes('Request Demo')) {
        showDemoModal();
    }
}

function handleNavButtonClick(e) {
    const button = e.target;
    
    if (button.textContent.includes('Login')) {
        showLoginModal();
    } else if (button.textContent.includes('Get Started')) {
        showSignupModal('Standard Plan');
    }
}

function showTrialModal(planName) {
    const modal = createModal(`
        <h2>Start Your Free Trial</h2>
        <p>Get started with ${planName} - No credit card required!</p>
        <form id="trialForm">
            <div class="form-group">
                <input type="text" placeholder="Institution Name" required>
            </div>
            <div class="form-group">
                <input type="email" placeholder="Email Address" required>
            </div>
            <div class="form-group">
                <input type="tel" placeholder="Phone Number">
            </div>
            <div class="form-group">
                <select required>
                    <option value="">Select Institution Type</option>
                    <option value="school">School</option>
                    <option value="tuition">Tuition Center</option>
                    <option value="institute">Institute</option>
                    <option value="university">University</option>
                </select>
            </div>
            <button type="submit" class="btn-primary btn-full">Start Free Trial</button>
        </form>
    `);
    
    document.getElementById('trialForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showNotification('Free trial started! Check your email for setup instructions.', 'success');
        closeModal();
    });
}

function showSignupModal(planName) {
    const modal = createModal(`
        <h2>Sign Up for ${planName}</h2>
        <p>Create your account to get started with Learnovo</p>
        <form id="signupForm">
            <div class="form-group">
                <input type="text" placeholder="Full Name" required>
            </div>
            <div class="form-group">
                <input type="email" placeholder="Email Address" required>
            </div>
            <div class="form-group">
                <input type="password" placeholder="Password" required>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Institution Name" required>
            </div>
            <div class="form-group">
                <select required>
                    <option value="">Select Institution Type</option>
                    <option value="school">School</option>
                    <option value="tuition">Tuition Center</option>
                    <option value="institute">Institute</option>
                    <option value="university">University</option>
                </select>
            </div>
            <button type="submit" class="btn-primary btn-full">Create Account</button>
            <div class="divider">or</div>
            <button type="button" class="btn-outline btn-full" onclick="handleGoogleSignup()">
                <i class="fab fa-google"></i> Sign up with Google
            </button>
        </form>
    `);
    
    document.getElementById('signupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showNotification('Account created successfully! Welcome to Learnovo.', 'success');
        closeModal();
    });
}

function showLoginModal() {
    const modal = createModal(`
        <h2>Login to Learnovo</h2>
        <p>Welcome back! Please sign in to your account</p>
        <form id="loginForm">
            <div class="form-group">
                <input type="email" placeholder="Email Address" required>
            </div>
            <div class="form-group">
                <input type="password" placeholder="Password" required>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox"> Remember me
                </label>
            </div>
            <button type="submit" class="btn-primary btn-full">Login</button>
            <div class="divider">or</div>
            <button type="button" class="btn-outline btn-full" onclick="handleGoogleLogin()">
                <i class="fab fa-google"></i> Login with Google
            </button>
            <p class="text-center">
                <a href="#" onclick="showForgotPassword()">Forgot your password?</a>
            </p>
        </form>
    `);
    
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showNotification('Login successful! Welcome back.', 'success');
        closeModal();
    });
}

function showDemoModal() {
    const modal = createModal(`
        <h2>Request a Demo</h2>
        <p>Schedule a personalized demo to see Learnovo in action</p>
        <form id="demoForm">
            <div class="form-group">
                <input type="text" placeholder="Full Name" required>
            </div>
            <div class="form-group">
                <input type="email" placeholder="Email Address" required>
            </div>
            <div class="form-group">
                <input type="tel" placeholder="Phone Number" required>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Institution Name" required>
            </div>
            <div class="form-group">
                <select required>
                    <option value="">Select Institution Type</option>
                    <option value="school">School</option>
                    <option value="tuition">Tuition Center</option>
                    <option value="institute">Institute</option>
                    <option value="university">University</option>
                </select>
            </div>
            <div class="form-group">
                <select required>
                    <option value="">Preferred Demo Time</option>
                    <option value="morning">Morning (9 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 8 PM)</option>
                </select>
            </div>
            <div class="form-group">
                <textarea placeholder="Any specific features you'd like to see?" rows="3"></textarea>
            </div>
            <button type="submit" class="btn-primary btn-full">Schedule Demo</button>
        </form>
    `);
    
    document.getElementById('demoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showNotification('Demo scheduled! We will contact you soon to confirm the time.', 'success');
        closeModal();
    });
}

function showContactModal(planName) {
    const modal = createModal(`
        <h2>Contact Sales - ${planName}</h2>
        <p>Get in touch with our sales team for custom pricing and enterprise features</p>
        <form id="contactSalesForm">
            <div class="form-group">
                <input type="text" placeholder="Full Name" required>
            </div>
            <div class="form-group">
                <input type="email" placeholder="Email Address" required>
            </div>
            <div class="form-group">
                <input type="tel" placeholder="Phone Number" required>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Institution Name" required>
            </div>
            <div class="form-group">
                <input type="number" placeholder="Number of Students" required>
            </div>
            <div class="form-group">
                <textarea placeholder="Tell us about your requirements" rows="4" required></textarea>
            </div>
            <button type="submit" class="btn-primary btn-full">Contact Sales</button>
        </form>
    `);
    
    document.getElementById('contactSalesForm').addEventListener('submit', (e) => {
        e.preventDefault();
        showNotification('Sales inquiry sent! Our team will contact you within 24 hours.', 'success');
        closeModal();
    });
}

function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeModal()">×</button>
            ${content}
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

function checkLoginStatus() {
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        updateLoginUI(userData.name, userData.picture);
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});

// Parallax effect for hero shapes
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const shapes = document.querySelectorAll('.shape');
    
    shapes.forEach((shape, index) => {
        const speed = 0.5 + (index * 0.1);
        shape.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add hover effects to cards
document.querySelectorAll('.feature-card, .testimonial-card, .pricing-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});

// Button click animations
document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline').forEach(btn => {
    btn.addEventListener('click', function(e) {
        // Create ripple effect
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Add ripple effect CSS
const style = document.createElement('style');
style.textContent = `
    .btn-primary, .btn-secondary, .btn-outline {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
