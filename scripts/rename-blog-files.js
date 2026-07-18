// Script para renomear arquivos de publicações do blog removendo caracteres especiais dos nomes
import fs from 'fs';
import path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

function sanitizeFilename(filename) {
  // Remove caracteres especiais, exceto letras, números, hífen e underline
  return filename
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Remove acentos
    .replace(/[^\w\d\-_\.]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífen
    .replace(/-+/g, '-') // Remove múltiplos hífens
    .replace(/^[-_]+|[-_]+$/g, ''); // Remove hífens/underlines do início/fim
}

fs.readdirSync(BLOG_DIR).forEach(file => {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const sanitized = sanitizeFilename(base) + ext;
  if (sanitized !== file) {
    const oldPath = path.join(BLOG_DIR, file);
    const newPath = path.join(BLOG_DIR, sanitized);
    fs.renameSync(oldPath, newPath);
    console.log(`Renomeado: ${file} -> ${sanitized}`);
  }
});
