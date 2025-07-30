const fs = require('fs');
const path = require('path');

// Read the Tailwind CSS files
const base = fs.readFileSync(path.join(__dirname, 'node_modules', 'tailwindcss', 'index.css'), 'utf8');
const preflight = fs.readFileSync(path.join(__dirname, 'node_modules', 'tailwindcss', 'preflight.css'), 'utf8');
const theme = fs.readFileSync(path.join(__dirname, 'node_modules', 'tailwindcss', 'theme.css'), 'utf8');
const utilities = fs.readFileSync(path.join(__dirname, 'node_modules', 'tailwindcss', 'utilities.css'), 'utf8');

// Combine all CSS
const combinedCSS = `${base}\n${preflight}\n${theme}\n${utilities}`;

// Write to modern-ui.css
fs.writeFileSync(path.join(__dirname, 'src', 'modern-ui.css'), combinedCSS);

console.log('Modern UI CSS built successfully!');