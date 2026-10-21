// Generate the folder index used by alex.html.
// Run this file from the Site folder with: node generate-manifest.js

const fs = require('fs');
const path = require('path');

// Resolve all paths relative to this script so it works from any current directory.
const root = __dirname;
const outputPath = path.join(root, 'content-manifest.json');

// These labels and icons describe the folder structure already used by the site.
const artCategories = [
  { key: 'sketch', label: 'Sketch', folder: 'Art/Sketch', icon: '0.%20Site_Assets/1_1_Sketch.png' },
  { key: '3d', label: '3D', folder: 'Art/3D', icon: '0.%20Site_Assets/1_2_3d.png' },
  { key: 'digital', label: 'Digital Art', folder: 'Art/Digital', icon: '0.%20Site_Assets/1_3_digital_art.png' }
];

// Browser URLs use forward slashes even when the generator runs on Windows.
function browserPath(value) {
  return value.split(path.sep).join('/');
}

// Sort folders and files predictably so the displayed order is repeatable.
function compareNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Read each year folder and return its direct files in filename order.
function readYears(folder) {
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return {};

  const years = {};
  fs.readdirSync(absoluteFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .sort((a, b) => Number(b.name) - Number(a.name))
    .forEach((yearEntry) => {
      const yearFolder = path.join(absoluteFolder, yearEntry.name);
      const files = fs.readdirSync(yearFolder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
        .sort((a, b) => compareNames(a.name, b.name))
        .map((entry) => browserPath(path.join(folder, yearEntry.name, entry.name)));

      if (files.length) years[yearEntry.name] = files;
    });

  return years;
}

// Build the same shape expected by the site's existing rendering functions.
const manifest = {
  generatedAt: new Date().toISOString(),
  art: {
    label: 'Art',
    folder: 'Art',
    icon: '0.%20Site_Assets/1_art.png',
    categories: Object.fromEntries(artCategories.map((category) => [category.key, {
      label: category.label,
      folder: category.folder,
      icon: category.icon,
      years: readYears(category.folder)
    }]))
  },
  video: {
    label: 'Video',
    folder: 'Video',
    icon: '0.%20Site_Assets/2_video.png',
    years: readYears('Video')
  },
  music: {
    label: 'Music',
    folder: 'Music',
    icon: '0.%20Site_Assets/3_music.png',
    years: readYears('Music')
  },
  photography: {
    label: 'Photography',
    folder: 'Art/Photography',
    icon: '0.%20Site_Assets/4_photography.png',
    years: readYears('Art/Photography')
  }
};

// Write a readable JSON file that can be inspected or committed with the site.
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifest generated: ${path.basename(outputPath)}`);
