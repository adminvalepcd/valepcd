import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Resolve current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images');

// Target extensions to convert to webp
const TARGET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'];

// Target directories/files to search and replace references
const CODE_DIRS = [
  path.join(PROJECT_ROOT, 'app'),
  path.join(PROJECT_ROOT, 'i18n'),
  path.join(PROJECT_ROOT, 'content'),
  path.join(PROJECT_ROOT, 'public') // to update sitemap.xml, admin/config.yml etc.
];
const CODE_FILES = [
  path.join(PROJECT_ROOT, 'nuxt.config.ts')
];

// File extensions in codebases where image references might exist
const CODE_EXTENSIONS = ['.vue', '.js', '.ts', '.json', '.yml', '.yaml', '.xml', '.css', '.html', '.md'];

// Helper to recursively find files in a directory matching specific extensions
function findFiles(dir, extensions, excludeDirs = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      if (excludeDirs.some(exclude => filePath.includes(exclude))) continue;
      results = results.concat(findFiles(filePath, extensions, excludeDirs));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// Helper to replace text in a file
function replaceInFile(filePath, replacements) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanged = false;

    for (const { from, to } of replacements) {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        hasChanged = true;
      }
    }

    if (hasChanged) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated references in: ${path.relative(PROJECT_ROOT, filePath)}`);
    }
  } catch (error) {
    console.error(`Error updating references in ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('--- Starting WebP Image Conversion & Reference Replacement ---');

  // 1. Find all target images in public/images/
  // Exclude node_modules, .nuxt, .output in recursive search just in case, though we are targeting public/images
  const imageFiles = findFiles(IMAGES_DIR, TARGET_EXTENSIONS);
  
  if (imageFiles.length === 0) {
    console.log('No images found that need conversion.');
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to convert.`);

  const replacements = [];

  // 2. Convert each image to WebP and delete original
  for (const inputPath of imageFiles) {
    const relativeInputPath = path.relative(PROJECT_ROOT, inputPath);
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${baseName}.webp`);

    console.log(`Converting: ${relativeInputPath} -> ${baseName}.webp`);

    try {
      // Perform conversion
      await sharp(inputPath).toFile(outputPath);

      // Verify the new file exists and is not empty before deleting the original
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        fs.unlinkSync(inputPath);
        console.log(`Deleted original: ${relativeInputPath}`);
        
        // Add to replacements list
        // Replace exact filename with its webp counterpart
        const originalFilename = `${baseName}${ext}`;
        const webpFilename = `${baseName}.webp`;
        replacements.push({ from: originalFilename, to: webpFilename });
      } else {
        throw new Error('Converted WebP file was empty or not written.');
      }
    } catch (error) {
      console.error(`Failed to convert ${relativeInputPath}:`, error.message);
    }
  }

  if (replacements.length === 0) {
    console.log('No successful conversions, skipping reference updates.');
    return;
  }

  // 3. Find all codebase files to update references
  console.log('\nScanning codebase for references...');
  let codeFiles = [...CODE_FILES];
  for (const dir of CODE_DIRS) {
    // Exclude images/ directory itself when scanning public/ to avoid scanning binary files
    const exclude = [IMAGES_DIR];
    codeFiles = codeFiles.concat(findFiles(dir, CODE_EXTENSIONS, exclude));
  }

  console.log(`Found ${codeFiles.length} file(s) in codebase to check for references.`);

  // 4. Perform search and replace in all code files
  for (const filePath of codeFiles) {
    replaceInFile(filePath, replacements);
  }

  console.log('\n--- WebP Conversion & Reference Replacement Complete ---');
}

main().catch(error => {
  console.error('Fatal error in image conversion script:', error);
  process.exit(1);
});
