const fs = require('fs');
const path = require('path');

const colorMap = {
  '#0A0C16': '#0F172A', // slate-900
  '#101223': '#1E293B', // slate-800
  '#181B34': '#334155', // slate-700
  '#222542': '#475569', // slate-600
  '#262A45': '#475569', // slate-600 (use same as hover for borders)
  '#2A2D48': '#64748B', // slate-500
  '#7E4CF3': '#3B82F6', // blue-500
  '#6839D6': '#2563EB', // blue-600
  '#6A3DE8': '#2563EB', // blue-600
  '#4A88E9': '#60A5FA', // blue-400
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;
  
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    // case insensitive replace
    const regex = new RegExp(oldColor, 'gi');
    if (regex.test(content)) {
      content = content.replace(regex, newColor);
      updated = true;
    }
  }
  
  if (updated) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
  }
});
