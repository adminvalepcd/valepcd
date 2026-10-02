import type { Geolocation, BoundingBox } from '../types';

export interface PhotoMetadata {
  location: Geolocation | null;
  capturedAt: Date | null;
}

function readExifAscii(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  isLittleEndian: boolean,
  length: number
): string {
  const count = view.getUint32(entryOffset + 4, isLittleEndian);
  if (count === 0 || count > 128) return '';
  const dataOffset = count <= 4
    ? entryOffset + 8
    : tiffStart + view.getUint32(entryOffset + 8, isLittleEndian);

  if (dataOffset < 0 || dataOffset + count > length) return '';

  let out = '';
  for (let i = 0; i < count; i++) {
    const code = view.getUint8(dataOffset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function parseExifDateString(dateStr: string, offsetStr?: string): Date | null {
  if (!dateStr) return null;
  // Formato EXIF padrão: "YYYY:MM:DD HH:MM:SS"
  const match = dateStr.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[T\s]+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr, hourStr, minStr, secStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minStr);
  const second = Number(secStr);

  if (year < 1990 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (offsetStr && /^[+-]\d{2}:\d{2}$/.test(offsetStr.trim())) {
    const iso = `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minStr}:${secStr}${offsetStr.trim()}`;
    const parsedIso = new Date(iso);
    if (!isNaN(parsedIso.getTime())) {
      return parsedIso;
    }
  }

  const localDate = new Date(year, month - 1, day, hour, minute, second);
  return isNaN(localDate.getTime()) ? null : localDate;
}

/**
 * Parser nativo e leve de metadados EXIF (coordenadas GPS + data/hora de captura) do arquivo JPEG.
 * Não utiliza dependências externas como exif-js, evitando incompatibilidades de bundling e travamentos.
 */
export async function extractPhotoMetadata(imageFile: File): Promise<PhotoMetadata> {
  const result: PhotoMetadata = {
    location: null,
    capturedAt: null
  };

  try {
    const buffer = await imageFile.arrayBuffer();
    const view = new DataView(buffer);

    // Verificar assinatura JPEG (SOI 0xFFD8)
    if (view.byteLength < 16 || view.getUint16(0, false) !== 0xFFD8) {
      return result;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset < length - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === 0xFFE1) { // Marcador APP1 (EXIF)
        const app1Length = view.getUint16(offset, false);
        const segmentStart = offset + 2;

        // Verificar assinatura 'Exif\0\0' (0x45786966 e 0x0000)
        if (
          segmentStart + 14 <= length &&
          view.getUint32(segmentStart, false) === 0x45786966 &&
          view.getUint16(segmentStart + 4, false) === 0x0000
        ) {
          const tiffStart = segmentStart + 6;
          const isLittleEndian = view.getUint16(tiffStart, false) === 0x4949; // 'II' (Intel)

          const ifd0Offset = view.getUint32(tiffStart + 4, isLittleEndian);
          let dirOffset = tiffStart + ifd0Offset;
          if (dirOffset + 2 > length) return result;

          const entriesCount = view.getUint16(dirOffset, isLittleEndian);
          dirOffset += 2;

          let gpsOffset = 0;
          let exifSubIfdOffset = 0;
          let ifd0DateTime = '';

          for (let i = 0; i < entriesCount; i++) {
            const entryOffset = dirOffset + (i * 12);
            if (entryOffset + 12 > length) break;
            const tag = view.getUint16(entryOffset, isLittleEndian);
            if (tag === 0x0132) { // DateTime (IFD0)
              ifd0DateTime = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
            } else if (tag === 0x8769) { // Ponteiro para Exif SubIFD
              exifSubIfdOffset = tiffStart + view.getUint32(entryOffset + 8, isLittleEndian);
            } else if (tag === 0x8825) { // Ponteiro para GPS IFD
              gpsOffset = tiffStart + view.getUint32(entryOffset + 8, isLittleEndian);
            }
          }

          let dateTimeOriginal = '';
          let dateTimeDigitized = '';
          let offsetTimeOriginal = '';

          // Ler Exif SubIFD (DateTimeOriginal, DateTimeDigitized, OffsetTimeOriginal)
          if (exifSubIfdOffset > 0 && exifSubIfdOffset + 2 < length) {
            const exifCount = view.getUint16(exifSubIfdOffset, isLittleEndian);
            const eOffset = exifSubIfdOffset + 2;
            for (let i = 0; i < exifCount; i++) {
              const entryOffset = eOffset + (i * 12);
              if (entryOffset + 12 > length) break;
              const tag = view.getUint16(entryOffset, isLittleEndian);
              if (tag === 0x9003) { // DateTimeOriginal
                dateTimeOriginal = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
              } else if (tag === 0x9004) { // DateTimeDigitized
                dateTimeDigitized = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
              } else if (tag === 0x9011 || tag === 0x9010) { // OffsetTimeOriginal / OffsetTime
                const offVal = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
                if (offVal && !offsetTimeOriginal) offsetTimeOriginal = offVal;
              }
            }
          }

          let gpsDateStamp = '';
          let gpsTimeUtc: [number, number, number] | null = null;

          // Ler GPS IFD (Coordenadas + GPSDateStamp/GPSTimeStamp)
          if (gpsOffset > 0 && gpsOffset + 2 < length) {
            const gpsCount = view.getUint16(gpsOffset, isLittleEndian);
            const pOffset = gpsOffset + 2;

            let latRef = 'N';
            let lonRef = 'E';
            let latValues: number | null = null;
            let lonValues: number | null = null;

            for (let i = 0; i < gpsCount; i++) {
              const entryOffset = pOffset + (i * 12);
              if (entryOffset + 12 > length) break;
              const tag = view.getUint16(entryOffset, isLittleEndian);
              const valOffset = tiffStart + view.getUint32(entryOffset + 8, isLittleEndian);

              if (tag === 0x0001) { // GPSLatitudeRef
                latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
              } else if (tag === 0x0003) { // GPSLongitudeRef
                lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
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
              } else if (tag === 0x0007 && valOffset + 24 <= length) { // GPSTimeStamp (3 racionais UTC)
                const hh = view.getUint32(valOffset, isLittleEndian) / (view.getUint32(valOffset + 4, isLittleEndian) || 1);
                const mm = view.getUint32(valOffset + 8, isLittleEndian) / (view.getUint32(valOffset + 12, isLittleEndian) || 1);
                const ss = view.getUint32(valOffset + 16, isLittleEndian) / (view.getUint32(valOffset + 20, isLittleEndian) || 1);
                gpsTimeUtc = [Math.floor(hh), Math.floor(mm), Math.floor(ss)];
              } else if (tag === 0x001D) { // GPSDateStamp ("YYYY:MM:DD")
                gpsDateStamp = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
              }
            }

            if (latValues !== null && lonValues !== null && !isNaN(latValues) && !isNaN(lonValues)) {
              if (latRef === 'S') latValues = -latValues;
              if (lonRef === 'W') lonValues = -lonValues;
              result.location = { latitude: latValues, longitude: lonValues };
            }
          }

          // Resolver data/hora de captura por ordem de prioridade: DateTimeOriginal > DateTimeDigitized > IFD0 DateTime > GPS UTC
          const chosenDateStr = dateTimeOriginal || dateTimeDigitized || ifd0DateTime;
          if (chosenDateStr) {
            result.capturedAt = parseExifDateString(chosenDateStr, offsetTimeOriginal);
          } else if (gpsDateStamp && gpsTimeUtc) {
            const m = gpsDateStamp.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})/);
            if (m) {
              const utcMs = Date.UTC(
                Number(m[1]),
                Number(m[2]) - 1,
                Number(m[3]),
                gpsTimeUtc[0],
                gpsTimeUtc[1],
                gpsTimeUtc[2]
              );
              if (!isNaN(utcMs)) {
                result.capturedAt = new Date(utcMs);
              }
            }
          }

          return result;
        }
        offset += app1Length;
      } else if ((marker & 0xFF00) === 0xFF00 && marker !== 0xFFD8 && marker !== 0xFFD9) {
        const segLength = view.getUint16(offset, false);
        offset += segLength;
      } else {
        break;
      }
    }
  } catch (err) {
    console.warn('[imageProcessor] Metadados EXIF não encontrados na foto ou formato não suportado:', err);
  }
  return result;
}

export async function extractGpsData(imageFile: File): Promise<Geolocation | null> {
  const metadata = await extractPhotoMetadata(imageFile);
  return metadata.location;
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
 * Aplica desfoque pesado e irreversível (blur intenso + destruição de caracteres em múltiplos estágios)
 * nas caixas delimitadoras de placas e rostos e compacta a imagem em WebP com alta definição,
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

      targets.forEach(rawBox => {
        let bx = typeof rawBox.x === 'number' ? rawBox.x : 0;
        let by = typeof rawBox.y === 'number' ? rawBox.y : 0;
        let bw = typeof rawBox.width === 'number' ? rawBox.width : 0;
        let bh = typeof rawBox.height === 'number' ? rawBox.height : 0;

        // Se coordenadas estiverem na escala 0-1000, normaliza para 0..1
        if (bx > 1 || by > 1 || bw > 1 || bh > 1) {
          bx /= 1000;
          by /= 1000;
          bw /= 1000;
          bh /= 1000;
        }

        // Margem de segurança ampliada (36% largura, 44% altura) para garantir cobertura total da placa/rosto
        const padW = bw * 0.36;
        const padH = bh * 0.44;
        const rawX = (bx - padW / 2) * targetW;
        const rawY = (by - padH / 2) * targetH;
        const rawW = (bw + padW) * targetW;
        const rawH = (bh + padH) * targetH;

        const x = Math.max(0, Math.floor(rawX));
        const y = Math.max(0, Math.floor(rawY));
        const w = Math.min(targetW - x, Math.ceil(rawW));
        const h = Math.min(targetH - y, Math.ceil(rawH));

        if (w <= 2 || h <= 2) return;

        // Desfoque pesado multi-estágio (compatível com Safari, Chrome, Firefox e WebViews móveis):
        // Estágio 1: Redução intermediária para suavizar amostras antes da compressão extrema
        const midW = Math.max(4, Math.round(w / 4));
        const midH = Math.max(3, Math.round(h / 4));
        const midCanvas = document.createElement('canvas');
        midCanvas.width = midW;
        midCanvas.height = midH;
        const midCtx = midCanvas.getContext('2d');

        // Estágio 2: Redução extrema (máx 5x3 pixels) para tornar matematicamente impossível
        // distinguir os 7 caracteres de uma placa ou feições de um rosto, mesmo em fotos de perto
        const miniW = Math.max(2, Math.min(5, Math.round(w / 28)));
        const miniH = Math.max(2, Math.min(3, Math.round(h / 22)));
        const miniCanvas = document.createElement('canvas');
        miniCanvas.width = miniW;
        miniCanvas.height = miniH;
        const miniCtx = miniCanvas.getContext('2d');

        if (midCtx && miniCtx) {
          midCtx.imageSmoothingEnabled = true;
          midCtx.imageSmoothingQuality = 'high';
          midCtx.drawImage(canvas, x, y, w, h, 0, 0, midW, midH);

          miniCtx.imageSmoothingEnabled = true;
          miniCtx.imageSmoothingQuality = 'high';
          miniCtx.drawImage(midCanvas, 0, 0, midW, midH, 0, 0, miniW, miniH);

          // Estágio 3: Mistura de pixels (Box Blur 3x3 em 3 passadas direto no ImageData do miniCanvas)
          // Garante homogeneização total do contraste entre letras pretas e fundo branco da placa
          try {
            const imgData = miniCtx.getImageData(0, 0, miniW, miniH);
            const data = imgData.data;
            for (let pass = 0; pass < 3; pass++) {
              const copy = new Uint8ClampedArray(data);
              for (let py = 0; py < miniH; py++) {
                for (let px = 0; px < miniW; px++) {
                  let r = 0, g = 0, b = 0, count = 0;
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                      const nx = Math.min(miniW - 1, Math.max(0, px + dx));
                      const ny = Math.min(miniH - 1, Math.max(0, py + dy));
                      const idx = (ny * miniW + nx) * 4;
                      r += copy[idx];
                      g += copy[idx + 1];
                      b += copy[idx + 2];
                      count++;
                    }
                  }
                  const outIdx = (py * miniW + px) * 4;
                  data[outIdx] = Math.round(r / count);
                  data[outIdx + 1] = Math.round(g / count);
                  data[outIdx + 2] = Math.round(b / count);
                  data[outIdx + 3] = 255;
                }
              }
            }
            miniCtx.putImageData(imgData, 0, 0);
          } catch {}

          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, 6);
          } else {
            ctx.rect(x, y, w, h);
          }
          ctx.clip();

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // IMPORTANTE: Primeiro desenha uma camada 100% opaca SEM filtro para cobrir totalmente
          // os pixels nítidos originais por baixo (evita que a transparência de borda do blur revele a placa!)
          try {
            ctx.filter = 'none';
          } catch {}
          ctx.drawImage(miniCanvas, 0, 0, miniW, miniH, x - 12, y - 12, w + 24, h + 24);

          // Em seguida, aplica filtro blur pesado de 28px expandido além das bordas do clip
          try {
            ctx.filter = 'blur(28px)';
          } catch {}
          const bleed = 32;
          ctx.drawImage(miniCanvas, 0, 0, miniW, miniH, x - bleed, y - bleed, w + bleed * 2, h + bleed * 2);
          ctx.drawImage(miniCanvas, 0, 0, miniW, miniH, x - bleed, y - bleed, w + bleed * 2, h + bleed * 2);

          // Camada translúcida fosca sutil (frosted glass) para quebrar qualquer resquício de contraste
          try {
            ctx.filter = 'none';
          } catch {}
          ctx.fillStyle = 'rgba(140, 140, 140, 0.22)';
          ctx.fillRect(x, y, w, h);

          ctx.restore();

          // Contorno estético sutil para visualização da área protegida
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1.5;
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 6);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }
          ctx.restore();
        }
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