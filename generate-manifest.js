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

// Find a nearby image to use as the poster for each 3D model.
function readModelMetadata(files) {
  return Object.fromEntries(files.map((browserFile) => {
    const absoluteFile = path.join(root, ...browserFile.split('/'));
    const folder = path.dirname(absoluteFile);
    const poster = fs.readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(entry.name).toLowerCase()))
      .sort((a, b) => compareNames(a.name, b.name))[0];

    return [browserFile, {
      thumbnail: poster ? browserPath(path.join(path.dirname(browserFile), poster.name)) : ''
    }];
  }));
}

// Preserve the project-page order for Dent's presentation images.
function readDentGallery(folder) {
  const order = [
    '9a5c7b6f-7813-41c5-81c8-9c8c5ce6d3f4',
    '6dd9df56-98bb-4ecc-9b7e-0c10d67242a6',
    'c9dfdc83-0014-4cc7-8316-05f0d69bf47e',
    'e2256cd7-1bb7-4bb6-aeb8-d802a82f4f29',
    'adc0d8ce-5d56-48c2-84d6-6c484cad55ed',
    'a3c83ae5-ce4d-424c-90f5-cac8f6cc80e5',
    '4fb4e28f-7ed3-49e3-ac99-3c33c73b85e8',
    '021a1f18-d1a9-4e63-b146-4abd162f8365',
    '1aed8b4e-d882-42a9-b72f-761f23e0fd91',
    'ea057fe5-c2ed-4149-acfa-148e5f847671',
    '0a06b932-e4ab-4949-ac88-60824cd00339',
    '03eaa3e3-7267-4c66-b00a-8a6855d49ea4',
    '434ac144-2078-4fa2-9a41-82c2f27559c8',
    '28da397d-ce07-42e4-86c3-0fcecf99144a',
    '12c7f923-c22f-43d2-a52c-9f102e10e563',
    '9bd39dbd-2591-4137-a223-bc24f3ac249b',
    '18ccd5e3-77d6-4fcf-84ab-e33fa922e1db',
    '7f9333f3-c449-4850-842c-94cd4a03d878'
  ];
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return [];
  const files = fs.readdirSync(absoluteFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name));
  return order.map((id) => {
    const match = files.find((entry) => entry.name.startsWith(`${id}_rw_1200`))
      || files.find((entry) => entry.name.startsWith(`${id}_rw_600`));
    return match ? browserPath(path.join(folder, match.name)) : null;
  }).filter(Boolean);
}

// Read embedded audio title/year tags and the extracted cover image for each track.
function readMediaMetadata(files) {
  return Object.fromEntries(files.map((browserFile) => {
    const absoluteFile = path.join(root, ...browserFile.split('/'));
    const fallbackTitle = path.basename(absoluteFile, path.extname(absoluteFile));
    let tags = {};
    try {
      const probe = execFileSync(process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe', [
        '-v', 'quiet', '-show_entries', 'format_tags=title,date,year,creation_time', '-of', 'json', '--', absoluteFile
      ], { encoding: 'utf8', shell: true });
      tags = JSON.parse(probe).format?.tags || {};
    } catch (error) {
      // Files without probeable tags use their filename as the display title.
    }

    const title = tags.title || fallbackTitle;
    const mediaDate = tags.date || tags.year || tags.creation_time || '';
    const yearMatch = String(mediaDate).match(/(?:19|20)\d{2}/);
    const thumbnailName = `${fallbackTitle}.jpg`;
    const thumbnailFile = path.join(root, 'Site_Assets', 'Music', thumbnailName);
    const thumbnail = fs.existsSync(thumbnailFile)
      ? browserPath(path.join('Site_Assets', 'Music', thumbnailName))
      : '';

    return [browserFile, {
      title,
      year: yearMatch ? yearMatch[0] : '',
      date: mediaDate,
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
function readGroups(folder, rootLabel = 'Selected Sketch') {
  const absoluteFolder = path.join(root, ...folder.split('/'));
  if (!fs.existsSync(absoluteFolder)) return [];

  const entries = fs.readdirSync(absoluteFolder, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'));
  const groups = [];
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .sort((a, b) => compareNames(a.name, b.name))
    .map((entry) => browserPath(path.join(folder, entry.name)));

  if (rootFiles.length) groups.push({ label: rootLabel, folder, works: rootFiles });

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
        : category.key === 'digital'
          ? (() => {
            const works = readFiles(category.folder)
              .filter((file) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(path.extname(file).slice(1).toLowerCase()));
            const workMetadata = readWorkMetadata(works);
            const groups = readGroups(category.folder, 'Selected Digital').map((group) => ({
              ...group,
              works: group.works.filter((file) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(path.extname(file).slice(1).toLowerCase()))
            })).filter((group) => group.works.length);
            return { works, groups, workMetadata };
          })()
        : category.key === '3d'
          ? (() => {
            const works = readFiles(category.folder)
              .filter((file) => ['glb', 'gltf'].includes(path.extname(file).slice(1).toLowerCase()));
            const video = readFiles(category.folder).find((file) => path.basename(file).toLowerCase() === 'hair physics demo.mp4');
            return { works, workMetadata: readModelMetadata(works), gallery: readDentGallery(category.folder), video };
          })()
          : { years: readYears(category.folder) })
    }]))
  },
  video: {
    label: 'Video',
    folder: 'Video',
    icon: '0.%20Site_Assets/2_video.png',
    ...(() => {
      const works = readFiles('Video')
        .filter((file) => ['mp4', 'webm', 'mov', 'avi'].includes(path.extname(file).slice(1).toLowerCase()));
      const workMetadata = Object.fromEntries(works.map((file) => {
        const metadata = readMediaMetadata([file])[file] || {};
        const folderYear = file.split('/').find((part) => /^\d{4}$/.test(part)) || '';
        return [file, {
          ...metadata,
          year: metadata.year || folderYear,
          date: metadata.date || folderYear
        }];
      }));
      const sortedWorks = [...works].sort((a, b) => {
        const dateOrder = (workMetadata[b]?.date || '').localeCompare(workMetadata[a]?.date || '');
        return dateOrder || compareNames(a, b);
      });
      return { works: sortedWorks, workMetadata };
    })()
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
    folder: 'Photography',
    icon: '0.%20Site_Assets/4_photography.png',
    ...(() => {
      const works = readFiles('Photography')
        .filter((file) => ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(path.extname(file).slice(1).toLowerCase()));
      const workMetadata = readWorkMetadata(works);
      const sortedWorks = [...works].sort((a, b) => {
        const dateOrder = (workMetadata[b]?.date || '').localeCompare(workMetadata[a]?.date || '');
        return dateOrder || compareNames(a, b);
      });
      return { works: sortedWorks, workMetadata };
    })()
  }
};

// Write a readable JSON file that can be inspected or committed with the site.
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifest generated: ${path.basename(outputPath)}`);
