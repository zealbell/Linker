// Scroll Reveal Animation
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Optional: Stop observing once revealed
            // observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Add fade-in classes to elements
document.querySelectorAll('.timeline-item, .bento-item').forEach(el => {
    el.classList.add('fade-in-section');
    observer.observe(el);
});

// Add CSS for the animation dynamically
const style = document.createElement('style');
style.textContent = `
    .fade-in-section {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.8s ease-out, transform 0.8s ease-out;
    }
    
    .fade-in-section.visible {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(style);

console.log('Linker System: Online');
