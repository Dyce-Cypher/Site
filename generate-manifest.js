// Generate the folder index used by alex.html.
// Run this file from the Site folder with: node generate-manifest.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Resolve all paths relative to this script so it works from any current directory.
const root = __dirname;
const outputPath = path.join(root, 'content-manifest.json');

// These labels and icons describe the folder structure already used by the site.
const artCategories = [
  { key: 'sketch', label: 'Sketch', folder: 'Art/Sketch', icon: '0.%20Site_Assets/1_1_sketch.png', grouped: true },
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

// Read every file below a folder, regardless of subfolder naming.
function readFiles(folder) {
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return [];

  const files = [];
  function visit(currentFolder, relativeParts) {
    fs.readdirSync(currentFolder, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return compareNames(a.name, b.name);
      })
      .forEach((entry) => {
        const absolutePath = path.join(currentFolder, entry.name);
        const nextParts = [...relativeParts, entry.name];
        if (entry.isDirectory()) visit(absolutePath, nextParts);
        else if (entry.isFile()) files.push(browserPath(path.join(folder, ...nextParts)));
      });
  }

  visit(absoluteFolder, []);
  return files;
}

// Read files directly inside a folder without treating nested folders as works.
function readRootFiles(folder) {
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return [];
  return fs.readdirSync(absoluteFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .sort((a, b) => compareNames(a.name, b.name))
    .map((entry) => browserPath(path.join(folder, entry.name)));
}

// Read embedded audio title/year tags and the extracted cover image for each track.
function readMediaMetadata(files) {
  return Object.fromEntries(files.map((browserFile) => {
    const absoluteFile = path.join(root, ...browserFile.split('/'));
    const fallbackTitle = path.basename(absoluteFile, path.extname(absoluteFile));
    let tags = {};
    try {
      const probe = execFileSync(process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe', [
        '-v', 'quiet', '-show_entries', 'format_tags', '-of', 'json', '--', absoluteFile
      ], { encoding: 'utf8', shell: true });
      tags = JSON.parse(probe).format?.tags || {};
    } catch (error) {
      // Files without probeable tags use their filename as the display title.
    }

    const title = tags.title || fallbackTitle;
    const yearMatch = String(tags.date || tags.year || '').match(/(?:19|20)\d{2}/);
    const thumbnailName = `${fallbackTitle}.jpg`;
    const thumbnailFile = path.join(root, 'Site_Assets', 'Music', thumbnailName);
    const thumbnail = fs.existsSync(thumbnailFile)
      ? browserPath(path.join('Site_Assets', 'Music', thumbnailName))
      : '';

    return [browserFile, {
      title,
      year: yearMatch ? yearMatch[0] : '',
      date: tags.date || tags.year || '',
      thumbnail
    }];
  }));
}

// Read a work year from embedded JPEG metadata, then filename, then its year folder.
function readWorkMetadata(files) {
  return Object.fromEntries(files.map((browserFile) => {
    const absoluteFile = path.join(root, ...browserFile.split('/'));
    const fileName = path.basename(absoluteFile);
    let date = '';
    try {
      const contents = fs.readFileSync(absoluteFile).toString('latin1');
      const embeddedDate = contents.match(/((?:19|20)\d{2}):([01]\d):([0-3]\d)[ T]([0-2]\d):([0-5]\d):([0-5]\d)/);
      if (embeddedDate) date = `${embeddedDate[1]}-${embeddedDate[2]}-${embeddedDate[3]}T${embeddedDate[4]}:${embeddedDate[5]}:${embeddedDate[6]}`;
    } catch (error) {
      // A missing or unreadable metadata block falls through to the other date sources.
    }

    if (!date) {
      const fileDate = fileName.match(/((?:19|20)\d{2})(\d{2})(\d{2})/);
      if (fileDate) date = `${fileDate[1]}-${fileDate[2]}-${fileDate[3]}`;
    }
    if (!date) {
      const folderYear = browserFile.match(/(?:^|\/)((?:19|20)\d{2})(?:\/|$)/);
      if (folderYear) date = `${folderYear[1]}-01-01`;
    }

    return [browserFile, { date, year: date.slice(0, 4) }];
  }));
}

// Preserve Sketch's folder groupings while keeping the full flat list available.
function readGroups(folder) {
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return [];

  const entries = fs.readdirSync(absoluteFolder, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'));
  const groups = [];
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .sort((a, b) => compareNames(a.name, b.name))
    .map((entry) => browserPath(path.join(folder, entry.name)));

  if (rootFiles.length) groups.push({ label: 'Selected Sketch', folder, works: rootFiles });

  entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => {
      const aYear = /^\d{4}$/.test(a.name);
      const bYear = /^\d{4}$/.test(b.name);
      if (aYear && bYear) return Number(b.name) - Number(a.name);
      if (aYear !== bYear) return aYear ? -1 : 1;
      return compareNames(a.name, b.name);
    })
    .forEach((entry) => {
      const groupFolder = path.join(folder, entry.name);
      const works = readFiles(groupFolder);
      if (works.length) groups.push({ label: entry.name, folder: browserPath(groupFolder), works });
    });

  return groups;
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
      ...(category.grouped
        ? (() => {
          const works = readFiles(category.folder);
          const workMetadata = readWorkMetadata(works);
          const groups = readGroups(category.folder).map((group) => ({
            ...group,
            works: [...group.works].sort((a, b) => {
              const dateOrder = (workMetadata[b]?.date || '').localeCompare(workMetadata[a]?.date || '');
              return dateOrder || compareNames(a, b);
            })
          }));
          return { works, groups, workMetadata };
        })()
        : { years: readYears(category.folder) })
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
    years: readYears('Music'),
    ...(() => {
      const works = readRootFiles('Music');
      const workMetadata = readMediaMetadata(works);
      const sortedWorks = [...works].sort((a, b) => {
        const dateOrder = (workMetadata[b]?.date || '').localeCompare(workMetadata[a]?.date || '');
        return dateOrder || compareNames(a, b);
      });
      return works.length ? { works: sortedWorks, workMetadata } : {};
    })()
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
