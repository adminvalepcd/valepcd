import type { Geolocation, BoundingBox } from '../types';

/**
 * Parser nativo e leve de coordenadas GPS a partir dos metadados EXIF do arquivo JPEG/HEIC.
 * Não utiliza dependências externas como exif-js, evitando incompatibilidades de bundling e travamentos.
 */
export async function extractGpsData(imageFile: File): Promise<Geolocation | null> {
  try {
    const buffer = await imageFile.arrayBuffer();
    const view = new DataView(buffer);

    // Verificar assinatura JPEG (SOI 0xFFD8)
    if (view.byteLength < 16 || view.getUint16(0, false) !== 0xFFD8) {
      return null;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset < length - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === 0xFFE1) { // Marcador APP1 (EXIF)
        const app1Length = view.getUint16(offset, false);
        offset += 2;

        // Verificar assinatura 'Exif\0\0' (0x45786966 e 0x0000)
        if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
          const tiffStart = offset + 6;
          const isLittleEndian = view.getUint16(tiffStart, false) === 0x4949; // 'II' (Intel)

          const ifd0Offset = view.getUint32(tiffStart + 4, isLittleEndian);
          let dirOffset = tiffStart + ifd0Offset;
          if (dirOffset + 2 > length) return null;

          const entriesCount = view.getUint16(dirOffset, isLittleEndian);
          dirOffset += 2;

          let gpsOffset = 0;
          for (let i = 0; i < entriesCount; i++) {
            if (dirOffset + (i * 12) + 12 > length) break;
            const tag = view.getUint16(dirOffset + (i * 12), isLittleEndian);
            if (tag === 0x8825) { // Ponteiro para GPS IFD
              gpsOffset = tiffStart + view.getUint32(dirOffset + (i * 12) + 8, isLittleEndian);
              break;
            }
          }

          if (gpsOffset > 0 && gpsOffset + 2 < length) {
            const gpsCount = view.getUint16(gpsOffset, isLittleEndian);
            let pOffset = gpsOffset + 2;

            let latRef = 'N';
            let lonRef = 'E';
            let latValues: number | null = null;
            let lonValues: number | null = null;

            for (let i = 0; i < gpsCount; i++) {
              if (pOffset + (i * 12) + 12 > length) break;
              const tag = view.getUint16(pOffset + (i * 12), isLittleEndian);
              const valOffset = tiffStart + view.getUint32(pOffset + (i * 12) + 8, isLittleEndian);

              if (tag === 0x0001) { // GPSLatitudeRef
                latRef = String.fromCharCode(view.getUint8(pOffset + (i * 12) + 8));
              } else if (tag === 0x0003) { // GPSLongitudeRef
                lonRef = String.fromCharCode(view.getUint8(pOffset + (i * 12) + 8));
              } else if (tag === 0x0002 && valOffset + 24 <= length) { // GPSLatitude (3 racionais)
                const d = view.getUint32(valOffset, isLittleEndian) / (view.getUint32(valOffset + 4, isLittleEndian) || 1);
                const m = view.getUint32(valOffset + 8, isLittleEndian) / (view.getUint32(valOffset + 12, isLittleEndian) || 1);
                const s = view.getUint32(valOffset + 16, isLittleEndian) / (view.getUint32(valOffset + 20, isLittleEndian) || 1);
                latValues = d + (m / 60) + (s / 3600);
              } else if (tag === 0x0004 && valOffset + 24 <= length) { // GPSLongitude (3 racionais)
                const d = view.getUint32(valOffset, isLittleEndian) / (view.getUint32(valOffset + 4, isLittleEndian) || 1);
                const m = view.getUint32(valOffset + 8, isLittleEndian) / (view.getUint32(valOffset + 12, isLittleEndian) || 1);
                const s = view.getUint32(valOffset + 16, isLittleEndian) / (view.getUint32(valOffset + 20, isLittleEndian) || 1);
                lonValues = d + (m / 60) + (s / 3600);
              }
            }

            if (latValues !== null && lonValues !== null) {
              if (latRef === 'S') latValues = -latValues;
              if (lonRef === 'W') lonValues = -lonValues;
              return { latitude: latValues, longitude: lonValues };
            }
          }
        }
        break;
      } else if ((marker & 0xFF00) === 0xFF00 && marker !== 0xFFD8 && marker !== 0xFFD9) {
        const segLength = view.getUint16(offset, false);
        offset += segLength;
      } else {
        break;
      }
    }
  } catch (err) {
    console.warn('[imageProcessor] Metadados GPS não encontrados na foto ou formato não suportado:', err);
  }
  return null;
}

/**
 * Redimensiona a foto antes de enviar para o Gemini, reduzindo o tráfego de rede
 * de vários megabytes para ~250KB sem perder detalhes para a IA reconhecer placas e carros.
 */
export function prepareImageForGemini(file: File, maxDim = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Gera JPEG otimizado para a IA (~200KB-300KB)
        const optimized = canvas.toDataURL('image/jpeg', 0.85);
        resolve(optimized);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Aplica desfoque (blur de 12px) nas caixas delimitadoras de placas e rostos
 * e compacta a imagem em WebP com alta definição (~30% mais qualidade),
 * respeitando o limite de 50.000 caracteres de célula do Google Sheets.
 */
export function blurSensitiveContentAndCompress(
  imageUrl: string,
  plates: BoundingBox[],
  faces: BoundingBox[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = imageUrl;

    image.onload = () => {
      // 1. Redimensionar para até 640px (mais que o dobro de nitidez em relação aos 400px anteriores)
      const MAX_DIM = 640;
      let targetW = image.naturalWidth;
      let targetH = image.naturalHeight;

      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Contexto 2D do Canvas indisponível'));
      }

      // Desenhar a foto base redimensionada
      ctx.drawImage(image, 0, 0, targetW, targetH);

      // Juntar todas as caixas a serem anonimizadas
      const targets = [...plates, ...faces];
      const paddingRatio = 0.12; // 12% de margem de segurança para cobrir bem os limites

      targets.forEach(box => {
        // Coordenadas normalizadas (0 a 1) para pixels
        const padW = box.width * paddingRatio;
        const padH = box.height * paddingRatio;
        const rawX = (box.x - padW / 2) * targetW;
        const rawY = (box.y - padH / 2) * targetH;
        const rawW = (box.width + padW) * targetW;
        const rawH = (box.height + padH) * targetH;

        const x = Math.max(0, rawX);
        const y = Math.max(0, rawY);
        const w = Math.min(targetW - x, rawW);
        const h = Math.min(targetH - y, rawH);

        if (w <= 0 || h <= 0) return;

        // Salvar contexto e criar região de recorte
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, w, h, 6);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();

        // Aplicar o blur de 12px queimado nos pixels
        ctx.filter = 'blur(12px)';
        ctx.drawImage(image, 0, 0, targetW, targetH);
        ctx.restore();

        // Contorno estético sutil para indicar área anonimizada
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
      });

      // 2. Exportar como WebP com qualidade aumentada em ~30% (iniciando em 0.80)
      // garantindo que fique abaixo de 48.000 caracteres (limite estrito da célula do Google Sheets é 50k)
      let quality = 0.80;
      let webpBase64 = canvas.toDataURL('image/webp', quality);

      while (webpBase64.length > 48000 && quality > 0.40) {
        quality -= 0.05;
        webpBase64 = canvas.toDataURL('image/webp', quality);
      }

      // Se ainda exceder 48.000 chars por excesso de detalhe na imagem, reduz dimensão gradualmente
      let currentW = targetW;
      let currentH = targetH;
      while (webpBase64.length > 48000 && currentW > 350) {
        currentW = Math.round(currentW * 0.9);
        currentH = Math.round(currentH * 0.9);
        const downCanvas = document.createElement('canvas');
        downCanvas.width = currentW;
        downCanvas.height = currentH;
        const downCtx = downCanvas.getContext('2d');
        if (downCtx) {
          downCtx.drawImage(canvas, 0, 0, currentW, currentH);
          webpBase64 = downCanvas.toDataURL('image/webp', Math.max(0.60, quality));
        } else {
          break;
        }
      }

      resolve(webpBase64);
    };

    image.onerror = (err) => reject(err);
  });
}