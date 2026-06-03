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

// Helper to parse blog posts and compile into static JSON file
function compileBlogPosts() {
  console.log('\n--- Compiling Blog Posts to JSON ---');
  const contentDir = path.join(PROJECT_ROOT, 'content', 'blog');
  const outputFilePath = path.join(PROJECT_ROOT, 'server', 'posts-data.json');

  if (!fs.existsSync(contentDir)) {
    console.warn(`Content directory does not exist: ${contentDir}`);
    // Write empty array to ensure compilation doesn't fail
    fs.writeFileSync(outputFilePath, JSON.stringify([]), 'utf8');
    return;
  }

  const files = fs.readdirSync(contentDir);
  const posts = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(contentDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (match) {
        const frontmatterRaw = match[1];
        const content = match[2].trim();
        
        const metadata = {};
        frontmatterRaw.split('\n').forEach((line) => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
            metadata[key] = value;
          }
        });
        
        const slug = file.replace(/\.md$/, '');
        
        posts.push({
          slug,
          title: metadata.title || 'Sem título',
          date: metadata.date || new Date().toISOString(),
          description: metadata.description || '',
          category: metadata.category || 'Outros',
          author: metadata.author || 'Vale PCD',
          image: metadata.image || undefined,
          content: content
        });
      }
    }
  }

  // Sort by date (newest first)
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Ensure output directory exists (server/ might not exist but it should)
  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`Compiled ${posts.length} blog posts into ${path.relative(PROJECT_ROOT, outputFilePath)}`);
}

// Helper to parse institutional documents and compile into static JSON file
function compileInstitutionalDocs() {
  console.log('\n--- Compiling Institutional Documents to JSON ---');
  const contentDir = path.join(PROJECT_ROOT, 'content', 'institucional');
  const outputFilePath = path.join(PROJECT_ROOT, 'server', 'institucional-data.json');

  if (!fs.existsSync(contentDir)) {
    console.warn(`Content directory does not exist: ${contentDir}`);
    // Write empty array to ensure compilation doesn't fail
    fs.writeFileSync(outputFilePath, JSON.stringify([]), 'utf8');
    return;
  }

  const files = fs.readdirSync(contentDir);
  const documents = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(contentDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (match) {
        const frontmatterRaw = match[1];
        const content = match[2].trim();
        
        const metadata = {};
        frontmatterRaw.split('\n').forEach((line) => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
            metadata[key] = value;
          }
        });
        
        const slug = file.replace(/\.md$/, '');
        
        documents.push({
          slug,
          title: metadata.title || 'Sem título',
          date: metadata.date || new Date().toISOString(),
          description: metadata.description || '',
          file: metadata.file || undefined,
          content: content
        });
      }
    }
  }

  // Sort by date (newest first)
  documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Ensure output directory exists
  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(documents, null, 2), 'utf8');
  console.log(`Compiled ${documents.length} institutional documents into ${path.relative(PROJECT_ROOT, outputFilePath)}`);
}

async function main() {
  console.log('--- Starting WebP Image Conversion & Reference Replacement ---');

  const imageFiles = findFiles(IMAGES_DIR, TARGET_EXTENSIONS);
  
  if (imageFiles.length > 0) {
    console.log(`Found ${imageFiles.length} image(s) to convert.`);
    const replacements = [];

    for (const inputPath of imageFiles) {
      const relativeInputPath = path.relative(PROJECT_ROOT, inputPath);
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const baseName = path.basename(inputPath, ext);
      const outputPath = path.join(dir, `${baseName}.webp`);

      console.log(`Converting: ${relativeInputPath} -> ${baseName}.webp`);

      try {
        await sharp(inputPath).toFile(outputPath);

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          fs.unlinkSync(inputPath);
          console.log(`Deleted original: ${relativeInputPath}`);
          
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

    if (replacements.length > 0) {
      console.log('\nScanning codebase for references...');
      let codeFiles = [...CODE_FILES];
      for (const dir of CODE_DIRS) {
        const exclude = [IMAGES_DIR];
        codeFiles = codeFiles.concat(findFiles(dir, CODE_EXTENSIONS, exclude));
      }

      console.log(`Found ${codeFiles.length} file(s) in codebase to check for references.`);

      for (const filePath of codeFiles) {
        replaceInFile(filePath, replacements);
      }
    }
  } else {
    console.log('No images found that need conversion.');
  }

  console.log('\n--- WebP Conversion & Reference Replacement Complete ---');

  // Compile blog posts to static JSON so they bundle inside production server build
  compileBlogPosts();

  // Compile institutional documents to static JSON so they bundle inside production server build
  compileInstitutionalDocs();
}

main().catch(error => {
  console.error('Fatal error in image conversion script:', error);
  process.exit(1);
});
