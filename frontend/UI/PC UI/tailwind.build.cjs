// Build-time Tailwind config (local CSS instead of the cdn.tailwindcss.com script).
// Theme lives in tailwind.config.js (shared); this file only adds what the CLI needs.
// Rebuild after changing classes:  npm run build:css  (in pathfinder-backend)
const theme = require('./tailwind.config.js');
const plugin = (name) => require(require.resolve(name, { paths: [process.cwd(), __dirname] }));
module.exports = {
  ...theme,
  content: { relative: true, files: ['./index.html', './js/**/*.js', './data/**/*.js'] },
  // the plugins are installed in pathfinder-backend (where build:css runs), not next to this file
  plugins: [plugin('@tailwindcss/forms'), plugin('@tailwindcss/container-queries')],
};
