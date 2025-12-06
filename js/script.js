console.log("Linker UI Loaded");

/**
 * Mesh Distortion Logic for DP Hover
 */
const canvas = document.getElementById('dp-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const wrapper = document.querySelector('.dp-wrapper');

// Image Setup
// Use double resolution for high-DPI (Retina) look, matching the canvas width=500, height=500
const img = new Image();
img.src = 'assets/images/display/01.jpg'; // Ensure this path is correct

let isLoaded = false;
img.onload = () => {
    isLoaded = true;
    render(0); // Initial render
};

// Mesh Config
const GRID_SIZE = 20; // 20x20 grid
let width, height;
// Set canvas internal resolution to match logical size or fixed high res?
// The HTML attribute says 500x500. Let's use that.
width = canvas.width;  // 500
height = canvas.height; // 500

// Animation State
let animationId = null;
let startTime = 0;
let isHovering = false;
let progress = 0; // 0 to 1
const DURATION = 600; // ms (Matches CSS transition)

// Hover Listeners
wrapper.addEventListener('mouseenter', () => {
    isHovering = true;
    startAnimation();
});

wrapper.addEventListener('mouseleave', () => {
    isHovering = false;
    startAnimation();
});

function startAnimation() {
    if (!animationId) {
        // Start loop if not running
        startTime = performance.now();
        requestAnimationFrame(animate);
    } else {
        // If already running, we just continue, but the target (isHovering) has changed.
        // We might need to adjust startTime to smooth out reversal if midway.
        // Simple linear interpolation logic handles reversal naturally if we track 'current progress'.
    }
}

// Current interpolated value for smooth transition
let currentT = 0;

function animate(timestamp) {
    // Determine target based on hover state
    const target = isHovering ? 1 : 0;

    // Smoothly interpolate currentT towards target
    // Using a step based on deltaTime would be better, but simple lerp works for effects
    // Let's implement a time-based step to match CSS duration

    const speed = 1 / (DURATION / 16.6); // approx increment per frame

    if (isHovering) {
        currentT += speed;
        if (currentT > 1) currentT = 1;
    } else {
        currentT -= speed;
        if (currentT < 0) currentT = 0;
    }

    // Render with current distortion factor
    // Distortion curve: 0 -> 1 -> 0 implies we want a peak at t=0.5?
    // User said: k1 (start) -> k2 (mid, distorted) -> k3 (end, normal)
    // So distortion amount should follow a bell curve or sine over `currentT`.

    // However, the user said: "tied to the current hovering annimation so a reversal ... would imply k3 -> k2 -> k1"
    // This implies `currentT` represents the CSS scale progress (0 to 1).
    // And distortion happens AS we scale.
    // So distortion strength = func(currentT). max at 0.5.

    const distortionStrength = Math.sin(currentT * Math.PI); // 0 at 0, 1 at 0.5, 0 at 1

    render(distortionStrength);

    // Stop loop if settled at ends
    if ((isHovering && currentT === 1) || (!isHovering && currentT === 0)) {
        animationId = null;
    } else {
        animationId = requestAnimationFrame(animate);
    }
}


function render(distortionFactor) {
    if (!isLoaded) return;

    ctx.clearRect(0, 0, width, height);

    // We draw the image by subdividing it into a grid
    // For each cell, we calculate skewed corners based on distortion

    const cols = GRID_SIZE;
    const rows = GRID_SIZE;
    const cellW = width / cols;
    const cellH = height / rows;

    // Max distortion radius/power
    const centerX = width / 2;
    const centerY = height / 2;
    // Max radius (corner)
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            // Source coords (texture space)
            const sx = x * cellW;
            const sy = y * cellH;
            const sw = cellW;
            const sh = cellH;

            // Calculate destination vertices for this cell quad
            // We need 4 points: TL, TR, BR, BL
            const p1 = distortPoint(sx, sy, distortionFactor, centerX, centerY, maxDist); // TL
            const p2 = distortPoint(sx + sw, sy, distortionFactor, centerX, centerY, maxDist); // TR
            const p3 = distortPoint(sx + sw, sy + sh, distortionFactor, centerX, centerY, maxDist); // BR
            const p4 = distortPoint(sx, sy + sh, distortionFactor, centerX, centerY, maxDist); // BL

            // Draw the cell using 2 triangles to allow non-rectangular warping
            // Triangle 1: p1, p2, p4 (Top-Left triangle)
            // Triangle 2: p2, p3, p4 (Bottom-Right triangle)

            // Since canvas drawImage can't warp, we must use affine transform clipping.
            drawTexturedTriangle(
                img,
                sx, sy,               // src x0, y0
                sx + sw, sy,          // src x1, y1
                sx, sy + sh,          // src x2, y2
                p1.x, p1.y,           // dst x0, y0
                p2.x, p2.y,           // dst x1, y1
                p4.x, p4.y            // dst x2, y2
            );

            drawTexturedTriangle(
                img,
                sx + sw, sy,          // src x1, y1
                sx + sw, sy + sh,     // src x3, y3
                sx, sy + sh,          // src x2, y2
                p2.x, p2.y,
                p3.x, p3.y,
                p4.x, p4.y
            );
        }
    }
}

// Function to calculate distorted position of a point (x,y)
function distortPoint(x, y, factor, cx, cy, maxR) {
    if (factor === 0) return { x, y };

    // Vector from center
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);

    // Normalize radius (0 to 1)
    const normR = r / maxR;

    // Distortion Logic:
    // "concave fish-eye ... zoomed in" -> Center expands.
    // This effectively means points move AWAY from center based on radius?
    // Or points move TOWARDS center?
    // "Zoom in": The stuff in the center gets bigger. So a point near center moves OUTWARD.
    // Formula: newR = r * (1 + strength * function(r)).

    // We want a nice bulge.
    // Try: r' = r + (r * factor * (1 - normR)); // More bulge near center?

    // Let's use a standard fisheye magnification
    // factor is 0 to 1. 
    // Peak factor (at animation middle) ~ 1.
    // Let's settle on a max strength.
    const maxStrength = 0.5; // How much bulge
    const strength = factor * maxStrength;

    // Function that grows r slightly more than 1 near center, falling off.
    // Actually, simple Barrel distortion: r_dest = r * (1 + k * r^2).
    // NO, that's complex to inverse if we are mapping src -> dest.
    // We are mapping Vertices (Dest Grid) -> Screen.
    // Wait, the grid IS the screen pixels? No.
    // The grid defines WHERE the texture points land.
    // If we want "Zoom In", the texture points (vertices) should move OUTWARD.
    // So if r=10, r' might become 12.

    // Let's apply a smooth sine bulge.
    // Push points away from center.
    const offset = Math.sin((1 - normR) * Math.PI / 2) * strength * 100;
    // 100px max displacement?

    // Simple radial displacement
    const newR = r + offset;

    // Calculate new coords
    // Protect against divide by zero (at center)
    if (r === 0) return { x: cx, y: cy };

    return {
        x: cx + (dx / r) * newR,
        y: cy + (dy / r) * newR
    };
}


/**
 * Helper to draw a textured triangle.
 * Inspired by various Canvas 3D rendering polyfills.
 * Solves Affine Transform to map (sx0,sy0)->(dx0,dy0), etc.
 */
function drawTexturedTriangle(img, sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
    ctx.save();

    // Clip to the destination triangle
    ctx.beginPath();
    ctx.moveTo(dx0, dy0);
    ctx.lineTo(dx1, dy1);
    ctx.lineTo(dx2, dy2);
    ctx.closePath();
    ctx.clip();

    // Compute Affine Transform Matrix (a, b, c, d, e, f)
    // x_dest = a*x_src + c*y_src + e
    // y_dest = b*x_src + d*y_src + f

    // We have 3 points, so 3 equations for x and 3 for y.
    // x0' = a*x0 + c*y0 + e
    // x1' = a*x1 + c*y1 + e
    // x2' = a*x2 + c*y2 + e
    // ... same for y

    // Since we are mapping from an axis-aligned texture triangles often (but not always for the 2nd one),
    // General solution is safer.

    const denom = (sx0 * (sy2 - sy1) - sx1 * (sy2 - sy0) + sx2 * (sy1 - sy0));
    if (Math.abs(denom) < 0.001) { ctx.restore(); return; } // Degenerate

    const m11 = - (sy0 * (dx2 - dx1) - sy1 * (dx2 - dx0) + sy2 * (dx1 - dx0)) / denom;
    const m12 = (sy0 * (dy2 - dy1) - sy1 * (dy2 - dy0) + sy2 * (dy1 - dy0)) / denom;
    const m21 = (sx0 * (dx2 - dx1) - sx1 * (dx2 - dx0) + sx2 * (dx1 - dx0)) / denom;
    const m22 = - (sx0 * (dy2 - dy1) - sx1 * (dy2 - dy0) + sx2 * (dy1 - dy0)) / denom;
    const dx = (sx0 * (sy2 * dx1 - sy1 * dx2) - sx1 * (sy2 * dx0 - sy0 * dx2) + sx2 * (sy1 * dx0 - sy0 * dx1)) / denom;
    const dy = (sx0 * (sy2 * dy1 - sy1 * dy2) - sx1 * (sy2 * dy0 - sy0 * dy2) + sx2 * (sy1 * dy0 - sy0 * dy1)) / denom;

    // Apply transform
    ctx.transform(m11, m12, m21, m22, dx, dy);

    // Draw the whole image (creating the texture)
    // The transform maps the source region correctly into the clip region
    ctx.drawImage(img, 0, 0);

    ctx.restore();
}
