import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { geohashForLocation } from 'geofire-common';
import sharp from 'sharp';

const SHEET_ID = '1884lKe9k5ANy-CGigLrWZR-5iDS9Tp_dnosT-ix4wiI';
const GVIZ_JSON_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw-12Ex8c5J4fXzg3bcP9ZLlzFDhgzClWydxsbzFedm1CcdcrOljKFokKuuOSUSSEFv/exec';

/**
 * Carrega variáveis do arquivo .env (e .env.local) na raiz do projeto sem dependências extras.
 */
function loadDotEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

/**
 * Faz o parse da resposta JSONP do endpoint gviz/tq?tqx=out:json do Google Sheets
 * e converte as linhas em objetos chave-valor.
 */
function parseGvizJsonResponse(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error('Resposta não está no formato gviz JSON (a planilha pode estar privada).');
  }

  const payload = JSON.parse(match[1]);
  if (!payload?.table?.cols || !payload?.table?.rows) {
    throw new Error('Estrutura table.cols / table.rows ausente no retorno gviz.');
  }

  let headers = payload.table.cols.map((col) => String(col.label || col.id || '').trim().toLowerCase());
  let startRowIdx = 0;

  // Caso o gviz não tenha preenchido col.label e a primeira linha seja o cabeçalho
  if (headers.every((h) => !h || /^[a-z]$/i.test(h)) && payload.table.rows.length > 0) {
    const firstRowCells = payload.table.rows[0].c || [];
    const candidateHeaders = firstRowCells.map((cell) =>
      cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim().toLowerCase() : ''
    );
    if (candidateHeaders.includes('id')) {
      headers = candidateHeaders;
      startRowIdx = 1;
    }
  }

  const rows = [];
  for (let i = startRowIdx; i < payload.table.rows.length; i++) {
    const rowCells = payload.table.rows[i]?.c || [];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;
      const cell = rowCells[j];
      obj[header] = cell && cell.v !== undefined && cell.v !== null ? cell.v : '';
    }
    rows.push(obj);
  }

  return rows;
}

/**
 * Busca os dados da planilha tentando primeiro o endpoint gviz JSON solicitado
 * e fazendo fallback automático para o endpoint Apps Script da planilha caso o gviz exija login.
 */
async function fetchSheetRows() {
  try {
    console.log(`📡 Buscando dados via Google Sheets gviz: ${GVIZ_JSON_URL}`);
    const gvizRes = await fetch(GVIZ_JSON_URL);
    if (gvizRes.ok) {
      const text = await gvizRes.text();
      if (text.includes('google.visualization.Query.setResponse')) {
        const parsed = parseGvizJsonResponse(text);
        console.log(`✅ ${parsed.length} linhas obtidas diretamente via gviz/tq.`);
        return parsed;
      }
    }
    console.warn('⚠️ Endpoint gviz exigiu autenticação/redirecionamento. Usando endpoint Apps Script da mesma planilha...');
  } catch (err) {
    console.warn('⚠️ Falha ao acessar gviz diretamente, usando endpoint Apps Script:', err.message);
  }

  const appsScriptUrl =
    process.env.NUXT_PUBLIC_APPS_SCRIPT_URL ||
    process.env.VITE_APPS_SCRIPT_URL ||
    DEFAULT_APPS_SCRIPT_URL;

  const urlObj = new URL(appsScriptUrl);
  urlObj.searchParams.set('include_photo', 'true');

  console.log(`📡 Buscando dados completos via Apps Script: ${urlObj.toString()}`);
  const res = await fetch(urlObj.toString());
  if (!res.ok) {
    throw new Error(`Falha ao buscar planilha via Apps Script (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Retorno inesperado da planilha (não é um array).');
  }

  console.log(`✅ ${data.length} linhas obtidas da planilha.`);
  return data;
}

/**
 * Converte uma string Base64 (com ou sem prefixo data:image/...;base64,) em Buffer binário WebP.
 */
async function base64ToWebpBuffer(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') {
    return null;
  }

  const trimmed = base64Str.trim();
  if (!trimmed) return null;

  let mimeType = 'image/webp';
  let rawBase64 = trimmed;

  const dataUriMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    rawBase64 = dataUriMatch[2];
  } else if (trimmed.includes(',')) {
    rawBase64 = trimmed.split(',').pop();
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length === 0) return null;

  // Se a imagem original na planilha for PNG/JPEG, converte para WebP para corresponder ao caminho .webp
  if (mimeType !== 'image/webp') {
    return await sharp(buffer).webp({ quality: 82 }).toBuffer();
  }

  return buffer;
}

/**
 * Sanitiza o ID para garantir que seja seguro como chave de documento e nome de arquivo no Storage.
 */
function sanitizeIncidentId(rawId, fallbackIndex) {
  const clean = String(rawId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean || `row-${fallbackIndex}`;
}

async function runMigration() {
  loadDotEnv();

  const firebaseConfig = {
    apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || ''
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.storageBucket) {
    throw new Error(
      'Variáveis do Firebase ausentes no .env (verifique FIREBASE_API_KEY, FIREBASE_PROJECT_ID e FIREBASE_STORAGE_BUCKET).'
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const rows = await fetchSheetRows();
  const forceOverwrite = process.argv.includes('--force');

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = sanitizeIncidentId(row.id || row.is, i + 1);
    const latitude = Number(row.latitude ?? row.lat);
    const longitude = Number(row.longitude ?? row.lng ?? row.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn(`⚠️ [${i + 1}/${rows.length}] Linha ${id} ignorada: coordenadas inválidas (${row.latitude}, ${row.longitude}).`);
      errorCount++;
      continue;
    }

    try {
      const docRef = doc(db, 'ocorrencias', id);
      if (!forceOverwrite) {
        const existingSnap = await getDoc(docRef);
        if (existingSnap.exists() && existingSnap.data()?.fotoUrl) {
          skippedCount++;
          continue;
        }
      }

      // 1. Extrair Base64 da coluna foto, converter para Buffer binário e subir para /ocorrencias/{id}.webp
      let fotoUrl = '';
      const rawFoto = row.foto || row.image || '';

      if (rawFoto) {
        const imageBuffer = await base64ToWebpBuffer(rawFoto);
        if (imageBuffer) {
          const fileRef = storageRef(storage, `ocorrencias/${id}.webp`);
          await uploadBytes(fileRef, imageBuffer, {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable'
          });
          fotoUrl = await getDownloadURL(fileRef);
        }
      }

      // 2. Calcular geohash via geofire-common ([lat, lng])
      const geohash = geohashForLocation([latitude, longitude]);

      // 3. Normalizar demais campos da planilha sem incluir o base64 bruto no Firestore
      const { foto, image, ...restRow } = row;
      const ativo =
        row.ativo !== undefined && row.ativo !== ''
          ? row.ativo === true || String(row.ativo).toLowerCase() === 'true'
          : true;

      const docData = {
        ...restRow,
        id,
        data: row.data || row.timestamp || new Date().toISOString(),
        latitude,
        longitude,
        geohash,
        fotoUrl,
        natureza: row.natureza ? String(row.natureza).trim() : 'infracao_veicular',
        ativo,
        motivo_denuncia: row.motivo_denuncia ? String(row.motivo_denuncia).trim() : '',
        cidade: row.cidade ? String(row.cidade).trim() : '',
        estado: row.estado ? String(row.estado).trim() : '',
        rua: row.rua ? String(row.rua).trim() : '',
        bairro: row.bairro ? String(row.bairro).trim() : '',
        classificacao: row.classificacao ? String(row.classificacao).trim().toUpperCase() : '',
        verificacao: row.verificacao ? String(row.verificacao).trim() : ''
      };

      // 4. Criar/atualizar documento na coleção "ocorrencias" do Firestore
      await setDoc(docRef, docData, { merge: true });

      successCount++;
      console.log(
        `✅ [${i + 1}/${rows.length}] Migrado: ocorrencias/${id} | geohash=${geohash} | cidade=${docData.cidade}/${docData.estado}`
      );
    } catch (err) {
      errorCount++;
      console.error(`❌ [${i + 1}/${rows.length}] Erro ao migrar ${id}:`, err?.message || err);
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Sincronização concluída!`);
  console.log(`   Novas migradas : ${successCount}`);
  console.log(`   Já existentes  : ${skippedCount}`);
  console.log(`   Falhas         : ${errorCount}`);
  console.log('========================================');
  process.exit(errorCount > 0 && successCount === 0 && skippedCount === 0 ? 1 : 0);
}

runMigration().catch((err) => {
  console.error('Erro fatal na migração:', err);
  process.exit(1);
});
