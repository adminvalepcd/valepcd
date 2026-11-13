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
              const fieldType = view.getUint16(entryOffset + 2, isLittleEndian);
              const valOffset = tiffStart + view.getUint32(entryOffset + 8, isLittleEndian);

              const readRationalComponent = (off: number): number => {
                if (fieldType === 10) {
                  // SRATIONAL (signed 32-bit numerator/denominator)
                  const num = view.getInt32(off, isLittleEndian);
                  const den = view.getInt32(off + 4, isLittleEndian) || 1;
                  return num / den;
                }
                const num = view.getUint32(off, isLittleEndian);
                const den = view.getUint32(off + 4, isLittleEndian) || 1;
                return num / den;
              };

              if (tag === 0x0001) { // GPSLatitudeRef
                const rawRef = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length) || String.fromCharCode(view.getUint8(entryOffset + 8));
                latRef = rawRef.trim().toUpperCase().charAt(0) || 'N';
              } else if (tag === 0x0003) { // GPSLongitudeRef
                const rawRef = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length) || String.fromCharCode(view.getUint8(entryOffset + 8));
                lonRef = rawRef.trim().toUpperCase().charAt(0) || 'E';
              } else if (tag === 0x0002 && valOffset + 24 <= length) { // GPSLatitude (3 racionais)
                const d = readRationalComponent(valOffset);
                const m = Math.abs(readRationalComponent(valOffset + 8));
                const s = Math.abs(readRationalComponent(valOffset + 16));
                const sign = d < 0 ? -1 : 1;
                latValues = sign * (Math.abs(d) + (m / 60) + (s / 3600));
              } else if (tag === 0x0004 && valOffset + 24 <= length) { // GPSLongitude (3 racionais)
                const d = readRationalComponent(valOffset);
                const m = Math.abs(readRationalComponent(valOffset + 8));
                const s = Math.abs(readRationalComponent(valOffset + 16));
                const sign = d < 0 ? -1 : 1;
                lonValues = sign * (Math.abs(d) + (m / 60) + (s / 3600));
              } else if (tag === 0x0007 && valOffset + 24 <= length) { // GPSTimeStamp (3 racionais UTC)
                const hh = view.getUint32(valOffset, isLittleEndian) / (view.getUint32(valOffset + 4, isLittleEndian) || 1);
                const mm = view.getUint32(valOffset + 8, isLittleEndian) / (view.getUint32(valOffset + 12, isLittleEndian) || 1);
                const ss = view.getUint32(valOffset + 16, isLittleEndian) / (view.getUint32(valOffset + 20, isLittleEndian) || 1);
                gpsTimeUtc = [Math.floor(hh), Math.floor(mm), Math.floor(ss)];
              } else if (tag === 0x001D) { // GPSDateStamp ("YYYY:MM:DD")
                gpsDateStamp = readExifAscii(view, tiffStart, entryOffset, isLittleEndian, length);
              }
            }

            if (latValues !== null && lonValues !== null && Number.isFinite(latValues) && Number.isFinite(lonValues)) {
              if (latRef === 'S' && latValues > 0) latValues = -latValues;
              if (lonRef === 'W' && lonValues > 0) lonValues = -lonValues;
              const isZeroCoord = Math.abs(latValues) < 0.0001 && Math.abs(lonValues) < 0.0001;
              const isValidRange = Math.abs(latValues) <= 90 && Math.abs(lonValues) <= 180;
              if (!isZeroCoord && isValidRange) {
                result.location = { latitude: latValues, longitude: lonValues };
              }
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

const MAX_SHORT_EDGE = 1080;
const MAX_LONG_EDGE = 1920;
const MAX_SAFE_CANVAS_EDGE = 4096;

/**
 * Calcula as dimensões finais para salvamento no servidor mantendo 100% da proporção original da foto,
 * respeitando o limite máximo de 1080x1920 (retrato) ou 1920x1080 (paisagem).
 */
function calculateFullHdDimensions(
  naturalWidth: number,
  naturalHeight: number
): { width: number; height: number } {
  if (!naturalWidth || !naturalHeight) {
    return { width: naturalWidth || MAX_SHORT_EDGE, height: naturalHeight || MAX_LONG_EDGE };
  }

  const isPortrait = naturalHeight >= naturalWidth;
  const maxW = isPortrait ? MAX_SHORT_EDGE : MAX_LONG_EDGE;
  const maxH = isPortrait ? MAX_LONG_EDGE : MAX_SHORT_EDGE;

  const scale = Math.min(1, maxW / naturalWidth, maxH / naturalHeight);
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale))
  };
}

/**
 * Prepara a foto para envio ao Gemini mantendo a resolução original da imagem
 * (normalizando apenas a orientação EXIF via Canvas para garantir 100% de alinhamento dos boxes).
 */
export function prepareImageForGemini(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const natW = img.naturalWidth || MAX_SHORT_EDGE;
        const natH = img.naturalHeight || MAX_LONG_EDGE;
        const safeScale = Math.min(1, MAX_SAFE_CANVAS_EDGE / Math.max(natW, natH));
        const width = Math.max(1, Math.round(natW * safeScale));
        const height = Math.max(1, Math.round(natH * safeScale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const fullResWebp = canvas.toDataURL('image/webp', 0.95);
        resolve(fullResWebp);
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
 * nas caixas delimitadoras de placas e rostos diretamente na resolução original da imagem analisada pelo Gemini,
 * garantindo que os boxes fiquem exatamente no lugar certo antes de qualquer redimensionamento.
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
      // 1. Manter a exata resolução da imagem analisada pelo Gemini ao posicionar e queimar os boxes
      const targetW = Math.max(1, image.naturalWidth || MAX_SHORT_EDGE);
      const targetH = Math.max(1, image.naturalHeight || MAX_LONG_EDGE);
      const scaleFactor = Math.max(1, Math.max(targetW, targetH) / MAX_LONG_EDGE);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Contexto 2D do Canvas indisponível'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Desenhar a foto base na resolução original
      ctx.drawImage(image, 0, 0, targetW, targetH);

      // Juntar todas as caixas a serem anonimizadas identificando o tipo (placa vs rosto)
      const targets = [
        ...plates.map(box => ({ box, type: 'plate' as const })),
        ...faces.map(box => ({ box, type: 'face' as const })),
      ];

      targets.forEach(({ box: rawBox, type }) => {
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

        // Salvaguarda geométrica para rostos: se o detector box_2d da IA retornar o corpo inteiro
        // ou o tronco do pedestre (caixa muito mais alta que larga em pixels), recorta apenas a região da cabeça no topo
        if (type === 'face' && targetW > 0 && targetH > 0) {
          const pxW = bw * targetW;
          const pxH = bh * targetH;
          if (pxH > pxW * 2.0) {
            // Caixa de corpo inteiro: cabeça fica no topo (~20% superiores) e centralizada horizontalmente
            const headPxH = Math.min(pxH * 0.22, pxW * 0.65);
            const headPxW = Math.min(pxW * 0.55, headPxH * 1.05);
            const newBw = headPxW / targetW;
            const newBh = headPxH / targetH;
            bx = bx + (bw - newBw) / 2;
            bw = newBw;
            bh = newBh;
          } else if (pxH > pxW * 1.35) {
            // Caixa de meio corpo / busto: restringe à porção superior da cabeça/rosto
            const headPxH = Math.min(pxH * 0.48, pxW * 1.1);
            const headPxW = Math.min(pxW * 0.85, headPxH * 1.05);
            const newBw = headPxW / targetW;
            const newBh = headPxH / targetH;
            bx = bx + (bw - newBw) / 2;
            bw = newBw;
            bh = newBh;
          }
        }

        // Placas usam margem ampliada (36% largura, 44% altura); rostos usam margem justa (12%) para não cobrir o corpo
        const padW = type === 'face' ? bw * 0.12 : bw * 0.36;
        const padH = type === 'face' ? bh * 0.12 : bh * 0.44;
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
        const midW = Math.max(4, Math.round(w / (4 * scaleFactor)));
        const midH = Math.max(3, Math.round(h / (4 * scaleFactor)));
        const midCanvas = document.createElement('canvas');
        midCanvas.width = midW;
        midCanvas.height = midH;
        const midCtx = midCanvas.getContext('2d');

        // Estágio 2: Redução extrema (máx 5x3 pixels) para tornar matematicamente impossível
        // distinguir os 7 caracteres de uma placa ou feições de um rosto, mesmo em fotos de perto
        const miniW = Math.max(2, Math.min(5, Math.round(w / (28 * scaleFactor))));
        const miniH = Math.max(2, Math.min(3, Math.round(h / (22 * scaleFactor))));
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

          const cornerRadius = Math.round(6 * scaleFactor);
          const innerPad = Math.round(12 * scaleFactor);
          const blurPx = Math.round(28 * scaleFactor);
          const bleed = Math.round(32 * scaleFactor);

          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, cornerRadius);
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
          ctx.drawImage(miniCanvas, 0, 0, miniW, miniH, x - innerPad, y - innerPad, w + innerPad * 2, h + innerPad * 2);

          // Em seguida, aplica filtro blur pesado expandido além das bordas do clip
          try {
            ctx.filter = `blur(${blurPx}px)`;
          } catch {}
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
          ctx.lineWidth = Math.max(1.5, 1.5 * scaleFactor);
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, cornerRadius);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }
          ctx.restore();
        }
      });

      // 2. Exportar em WebP na resolução original com os boxes já queimados na imagem
      const webpBase64 = canvas.toDataURL('image/webp', 0.95);
      resolve(webpBase64);
    };

    image.onerror = (err) => reject(err);
  });
}

/**
 * Redimensiona a imagem já anonimizada (com os boxes já aplicados na posição exata)
 * para o limite máximo de 1080x1920 (retrato) ou 1920x1080 (paisagem) em WebP
 * somente no momento de salvar no servidor.
 */
export function resizeImageForServer(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      return resolve(imageUrl);
    }

    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = imageUrl;

    image.onload = () => {
      const { width: targetW, height: targetH } = calculateFullHdDimensions(
        image.naturalWidth,
        image.naturalHeight
      );

      // Se a imagem já estiver dentro do limite Full HD, retorna em WebP sem necessidade de reescalar
      if (targetW === image.naturalWidth && targetH === image.naturalHeight && imageUrl.startsWith('data:image/webp')) {
        return resolve(imageUrl);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(imageUrl);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, targetW, targetH);

      const resizedWebp = canvas.toDataURL('image/webp', 1.0);
      resolve(resizedWebp);
    };

    image.onerror = (err) => reject(err);
  });
}

/**
 * Compara duas imagens (Base64 / Object URL) reduzindo-as a uma grade 16x16 no Canvas
 * para verificar se são a mesma foto (idênticas ou quase idênticas).
 */
export function areImagesVisuallyIdentical(imageUrlA: string, imageUrlB: string): Promise<boolean> {
  if (!imageUrlA || !imageUrlB) return Promise.resolve(false);
  if (imageUrlA === imageUrlB) return Promise.resolve(true);

  const loadSample = (url: string): Promise<Uint8ClampedArray | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, 16, 16);
          resolve(ctx.getImageData(0, 0, 16, 16).data);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  return Promise.all([loadSample(imageUrlA), loadSample(imageUrlB)]).then(([dataA, dataB]) => {
    if (!dataA || !dataB || dataA.length !== dataB.length) return false;
    let totalDiff = 0;
    const channels = (dataA.length / 4) * 3;
    for (let i = 0; i < dataA.length; i += 4) {
      totalDiff += Math.abs(dataA[i] - dataB[i]);
      totalDiff += Math.abs(dataA[i + 1] - dataB[i + 1]);
      totalDiff += Math.abs(dataA[i + 2] - dataB[i + 2]);
    }
    const meanDiff = totalDiff / channels;
    return meanDiff < 5.5;
  });
}

export interface IncidentShareCardOptions {
  photoUrl?: string;
  photoSrc?: string;
  resolvedPhotoUrl?: string;
  afterPhotoSrc?: string;
  isResolved?: boolean;
  natureza?: string;
  verificacao?: string;
  descricao?: string;
  cidade?: string;
  estado?: string;
  locationText: string;
  latitude: number;
  longitude: number;
  timestamp?: string | number;
}

/**
 * Codifica as coordenadas (e minuto aproximado) em um token curto em Base36
 * para compartilhamento de link direto no mapa sem expor o ID da denúncia.
 */
export function encodeIncidentShareToken(
  latitude: number,
  longitude: number,
  timestamp?: string | number
): string {
  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
  const latInt = Math.max(0, Math.round((latNum + 90) * 100000));
  const lngInt = Math.max(0, Math.round((lngNum + 180) * 100000));
  const baseToken = `${latInt.toString(36)}-${lngInt.toString(36)}`;
  if (timestamp) {
    const tsMs = new Date(timestamp).getTime();
    if (Number.isFinite(tsMs) && tsMs > 0) {
      const tsMin = Math.floor(tsMs / 60000);
      return `${baseToken}-${tsMin.toString(36)}`;
    }
  }
  return baseToken;
}

/**
 * Decodifica o token curto gerado por encodeIncidentShareToken.
 */
export function decodeIncidentShareToken(
  token: string
): { latitude: number; longitude: number; timestampMin?: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split(/[-_]/);
  if (parts.length < 2) return null;
  const latInt = parseInt(parts[0], 36);
  const lngInt = parseInt(parts[1], 36);
  if (!Number.isFinite(latInt) || !Number.isFinite(lngInt)) return null;
  const latitude = Number((latInt / 100000 - 90).toFixed(5));
  const longitude = Number((lngInt / 100000 - 180).toFixed(5));
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const timestampMin = parts[2] ? parseInt(parts[2], 36) : undefined;
  return {
    latitude,
    longitude,
    timestampMin: Number.isFinite(timestampMin) ? timestampMin : undefined
  };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

const shareImageMemoryCache = new Map<string, string>();

export interface PhotoCropAdjustment {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
}

export async function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof window === 'undefined') return null;

  const loadFromUrl = (urlToLoad: string, useCors: boolean): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      if (useCors) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = urlToLoad;
    });

  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return loadFromUrl(src, false);
  }

  const cachedDataUrl = shareImageMemoryCache.get(src);
  if (cachedDataUrl) {
    const fromMem = await loadFromUrl(cachedDataUrl, false);
    if (fromMem) return fromMem;
  }

  // 1. Lê diretamente do CacheStorage do navegador ('multei-images-cache-v2')
  if ('caches' in window) {
    try {
      const cache = await window.caches.open('multei-images-cache-v2');
      const cachedResp = await cache.match(src, { ignoreVary: true });
      if (cachedResp && cachedResp.ok && cachedResp.type !== 'opaque') {
        const blob = await cachedResp.blob();
        if (blob.size > 0) {
          const objUrl = URL.createObjectURL(blob);
          const loaded = await loadFromUrl(objUrl, false);
          setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
          if (loaded) return loaded;
        }
      }
    } catch {}
  }

  // 2. Caso ainda não esteja como blob no CacheStorage, lê do cache HTTP do navegador com CORS
  // (com fallback 'reload' apenas se o cache HTTP de disco antigo for anterior à ativação do CORS)
  try {
    const resp = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'force-cache' }).catch(() =>
      fetch(src, { mode: 'cors', credentials: 'omit', cache: 'reload' })
    );
    if (resp.ok) {
      if ('caches' in window) {
        try {
          const cache = await window.caches.open('multei-images-cache-v2');
          await cache.put(src, resp.clone());
        } catch {}
      }
      const blob = await resp.blob();
      if (blob.size > 0) {
        const objUrl = URL.createObjectURL(blob);
        const loaded = await loadFromUrl(objUrl, false);
        setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
        if (loaded) return loaded;
      }
    }
  } catch {}

  return loadFromUrl(src, true);
}

function drawImageSmartInFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  radius: number,
  alwaysCover = false,
  crop?: PhotoCropAdjustment
) {
  ctx.save();
  drawRoundedRectPath(ctx, fx, fy, fw, fh, radius);
  ctx.clip();

  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const imgRatio = iw / ih;
  const frameRatio = fw / fh;

  const zoom = Math.min(3, Math.max(1, Number(crop?.zoom) || 1));
  const offsetX = Math.min(1, Math.max(-1, Number(crop?.offsetX) || 0));
  const offsetY = Math.min(1, Math.max(-1, Number(crop?.offsetY) || 0));

  const coverScale = Math.max(fw / iw, fh / ih) * zoom;
  const coverW = iw * coverScale;
  const coverH = ih * coverScale;
  const maxShiftX = Math.max(0, (coverW - fw) / 2);
  const maxShiftY = Math.max(0, (coverH - fh) / 2);
  const coverX = fx + (fw - coverW) / 2 + offsetX * maxShiftX;
  const coverY = fy + (fh - coverH) / 2 + offsetY * maxShiftY;

  const ratioDiff = Math.abs(imgRatio - frameRatio) / frameRatio;

  if (alwaysCover || crop || ratioDiff <= 0.38) {
    ctx.drawImage(img, coverX, coverY, coverW, coverH);
  } else {
    // Fundo preenchido com desfoque suave + imagem inteira nítida centralizada
    ctx.save();
    ctx.filter = 'blur(26px) brightness(0.72)';
    ctx.drawImage(img, coverX - 24, coverY - 24, coverW + 48, coverH + 48);
    ctx.restore();

    const containScale = Math.min(fw / iw, fh / ih);
    const containW = iw * containScale;
    const containH = ih * containScale;
    const containX = fx + (fw - containW) / 2;
    const containY = fy + (fh - containH) / 2;
    ctx.drawImage(img, containX, containY, containW, containH);
  }

  ctx.restore();
}

export function drawInteractiveCropFrame(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  crop: PhotoCropAdjustment,
  showGrid = true
): { maxShiftX: number; maxShiftY: number } {
  const ctx = canvas.getContext('2d');
  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  if (!ctx) return { maxShiftX: 0, maxShiftY: 0 };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, fw, fh);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, fw, fh);

  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const zoom = Math.min(3, Math.max(1, Number(crop?.zoom) || 1));
  const coverScale = Math.max(fw / iw, fh / ih) * zoom;
  const coverW = iw * coverScale;
  const coverH = ih * coverScale;
  const maxShiftX = Math.max(0, (coverW - fw) / 2);
  const maxShiftY = Math.max(0, (coverH - fh) / 2);

  drawImageSmartInFrame(ctx, img, 0, 0, fw, fh, 0, true, crop);

  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 2; i++) {
      const gx = Math.round((fw * i) / 3);
      const gy = Math.round((fh * i) / 3);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, fh);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(fw, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  return { maxShiftX, maxShiftY };
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const nextTry = `${currentLine} ${words[j]}`;
          if (ctx.measureText(`${nextTry}…`).width <= maxWidth) {
            currentLine = nextTry;
          } else {
            currentLine = `${currentLine}…`;
            break;
          }
        }
        break;
      }
    }
  }
  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function getShareHeadlineInfo(options: {
  isResolved?: boolean;
  natureza?: string;
  verificacao?: string;
}): {
  line1: string;
  line2: string;
  badgeIcon: string;
  badgeBg: string;
  shareTitlePlain: string;
} {
  if (options.isResolved) {
    return {
      line1: 'Problema de Mobilidade',
      line2: 'Resolvido',
      badgeIcon: '✓',
      badgeBg: '#16a34a',
      shareTitlePlain: 'Problema de Mobilidade Resolvido'
    };
  }

  const nat = String(options.natureza || '').trim().toLowerCase();
  const verif = String(options.verificacao || '').trim().toLowerCase();

  if (nat === 'urbana') {
    return {
      line1: 'Denúncia de',
      line2: 'Mobilidade Urbana',
      badgeIcon: '🚧',
      badgeBg: '#d97706',
      shareTitlePlain: 'Denúncia de Mobilidade Urbana'
    };
  }

  if (verif.includes('exclusiva')) {
    return {
      line1: 'Denúncia de Vaga',
      line2: 'Exclusiva PcD',
      badgeIcon: '♿',
      badgeBg: '#86007D',
      shareTitlePlain: 'Denúncia de Vaga Exclusiva PcD'
    };
  }

  if (verif.includes('transferencia')) {
    return {
      line1: 'Denúncia de Área',
      line2: 'de Transferência',
      badgeIcon: '♿',
      badgeBg: '#86007D',
      shareTitlePlain: 'Denúncia de Área de Transferência'
    };
  }

  if (verif.includes('pedestre')) {
    return {
      line1: 'Denúncia de Faixa',
      line2: 'de Pedestres',
      badgeIcon: '🚷',
      badgeBg: '#86007D',
      shareTitlePlain: 'Denúncia de Faixa de Pedestres'
    };
  }

  return {
    line1: 'Denúncia de',
    line2: 'Infração de Trânsito',
    badgeIcon: '♿',
    badgeBg: '#86007D',
    shareTitlePlain: 'Denúncia de Infração de Trânsito'
  };
}

const VALE_PCD_LOGO_URL = '/images/multei/logo-vale-pcd.webp';
const VALE_PCD_SKYLINE_URL = '/images/multei/ig-skyline.webp';
const VALE_PCD_REPORT_STREET_URL = '/images/multei/ig-report-street-bw.webp';
const VALE_PCD_FONT_STACK =
  'Poppins, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const BRAND_PURPLE = '#81007A';
const BRAND_FOOTER_PURPLE = '#86007D';

const staticAssetPromiseCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadStaticTemplateAsset(assetPath: string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = staticAssetPromiseCache.get(assetPath);
  if (existing) return existing;

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      staticAssetPromiseCache.delete(assetPath);
      resolve(null);
    };
    img.src = assetPath;
  });

  staticAssetPromiseCache.set(assetPath, p);
  return p;
}

async function ensureCanvasFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.race([
      (document as Document & { fonts: FontFaceSet }).fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 750))
    ]);
  } catch {}
}

function fitFontSizeWithStyle(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontStylePrefix: string,
  fontStack: string,
  maxPx: number,
  minPx: number,
  maxWidth: number
): number {
  let size = maxPx;
  while (size > minPx) {
    ctx.font = `${fontStylePrefix} ${size}px ${fontStack}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 2;
  }
  return minPx;
}

function drawCoverImageInRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  anchorYRatio = 0.5
): void {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(rw / iw, rh / ih);
  const cw = iw * scale;
  const ch = ih * scale;
  const cx = rx + (rw - cw) / 2;
  const cy = ry + (rh - ch) * anchorYRatio;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(img, cx, cy, cw, ch);
  ctx.restore();
}

export interface InstagramStoryUserTagPoint {
  username: string;
  x: number;
  y: number;
}

export interface InstagramCarouselSlideOptions {
  slideIndex: number;
  totalSlides: number;
  cidade: string;
  estado: string;
  rua?: string;
  bairro?: string;
  natureza?: string;
  verificacao?: string;
  isResolved?: boolean;
  photoUrl: string;
  resolvedPhotoUrl?: string;
  footerUrlText?: string;
  crop?: PhotoCropAdjustment;
  resolvedCrop?: PhotoCropAdjustment;
}

export interface InstagramGeneralReportCardOptions {
  title: string;
  periodSubtitle?: string;
  totalGeral: number;
  cidadesCount: number;
  infracoesTransito: number;
  mobilidadeUrbana: number;
  resolvidos: number;
  footerMessageText?: string;
  footerUrlText?: string;
}

export interface InstagramStorySlideOptions extends InstagramCarouselSlideOptions {
  tagHandles?: string[];
}

export interface InstagramGeneralReportStoryOptions extends InstagramGeneralReportCardOptions {
  tagHandles?: string[];
}

function sanitizeStoryTagHandles(rawHandles?: string[]): string[] {
  if (!Array.isArray(rawHandles) || rawHandles.length === 0) return [];
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const entry of rawHandles) {
    const pieces = String(entry || '')
      .split(/[\s,;]+/)
      .map((s) => s.trim().replace(/^@+/, '').toLowerCase())
      .filter(Boolean);
    for (const h of pieces) {
      if (!/^[a-z0-9._]{1,30}$/.test(h) || seen.has(h)) continue;
      seen.add(h);
      valid.push(h);
      if (valid.length >= 4) return valid;
    }
  }

  return valid;
}

/**
 * Desenha pílulas discretas de `@perfil` em linha única (auto-ajustando de 21px até 14px para caber
 * sem quebrar nem sobrepor) e retorna as coordenadas normalizadas `(x, y)` exatas (0.0..1.0).
 */
function drawDiscreetStoryMentionPills(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  centerY: number,
  rawHandles: string[] | undefined,
  fontStack: string
): InstagramStoryUserTagPoint[] {
  const handles = sanitizeStoryTagHandles(rawHandles);
  if (handles.length === 0) return [];

  const maxRowWidth = W - 116;
  const pillGap = 12;
  let fontPx = 21;
  let padX = 16;
  let labels = handles.map((h) => `@${h}`);
  let pillWidths: number[] = [];

  while (fontPx >= 14) {
    padX = Math.max(12, Math.round(fontPx * 0.78));
    ctx.font = `600 ${fontPx}px ${fontStack}`;
    pillWidths = labels.map((lbl) => Math.ceil(ctx.measureText(lbl).width) + padX * 2);
    const totalW =
      pillWidths.reduce((acc, w) => acc + w, 0) + pillGap * Math.max(0, handles.length - 1);
    if (totalW <= maxRowWidth) break;
    fontPx -= 1;
  }

  if (fontPx < 14) {
    fontPx = 14;
    padX = 12;
    ctx.font = `600 ${fontPx}px ${fontStack}`;
    const maxSinglePillW = Math.floor(
      (maxRowWidth - pillGap * Math.max(0, handles.length - 1)) / handles.length
    );
    labels = labels.map((lbl) => {
      let truncated = lbl;
      while (
        truncated.length > 4 &&
        Math.ceil(ctx.measureText(`${truncated}…`).width) + padX * 2 > maxSinglePillW
      ) {
        truncated = truncated.slice(0, -1);
      }
      return truncated === lbl ? lbl : `${truncated}…`;
    });
    pillWidths = labels.map((lbl) => Math.ceil(ctx.measureText(lbl).width) + padX * 2);
  }

  const pillH = Math.max(32, Math.round(fontPx * 1.65));
  const totalRowW =
    pillWidths.reduce((acc, w) => acc + w, 0) + pillGap * Math.max(0, handles.length - 1);
  let cursorX = (W - totalRowW) / 2;
  const pillY = centerY - pillH / 2;

  const tagPoints: InstagramStoryUserTagPoint[] = [];

  for (let i = 0; i < handles.length; i++) {
    const pw = pillWidths[i];
    drawRoundedRectPath(ctx, cursorX, pillY, pw, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(129, 0, 122, 0.28)';
    ctx.stroke();

    ctx.font = `600 ${fontPx}px ${fontStack}`;
    ctx.fillStyle = '#6b0065';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cursorX + pw / 2, centerY + 1);

    const normX = Math.min(0.95, Math.max(0.05, Number(((cursorX + pw / 2) / W).toFixed(3))));
    const normY = Math.min(0.95, Math.max(0.05, Number((centerY / H).toFixed(3))));
    tagPoints.push({
      username: handles[i],
      x: normX,
      y: normY
    });

    cursorX += pw + pillGap;
  }

  return tagPoints;
}

/**
 * Renderiza o template oficial "Hoje em {Cidade}" da Vale PCD em `1080x1920` (9:16) ou `1080x1350` (4:5).
 */
async function renderValePcdCityOccurrenceCanvas(params: {
  aspect: '9:16' | '4:5';
  cidade: string;
  addressLine: string;
  photoUrl: string;
  resolvedPhotoUrl?: string;
  isResolved?: boolean;
  tagHandles?: string[];
  footerUrlText?: string;
  crop?: PhotoCropAdjustment;
  resolvedCrop?: PhotoCropAdjustment;
}): Promise<{ canvas: HTMLCanvasElement; userTags: InstagramStoryUserTagPoint[] }> {
  await ensureCanvasFontsReady();

  const isVerticalStory = params.aspect === '9:16';
  const W = 1080;
  const H = isVerticalStory ? 1920 : 1350;
  const FOOTER_H = isVerticalStory ? 162 : 120;
  const BODY_H = H - FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D indisponível para renderizar a arte.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Fundo claro off-white fiel ao modelo
  ctx.fillStyle = '#FAFAFB';
  ctx.fillRect(0, 0, W, BODY_H);

  // Carrega ativos estáticos em paralelo com a(s) foto(s) da ocorrência
  const [logoImg, skylineImg, mainOrBeforeImg, afterImg] = await Promise.all([
    loadStaticTemplateAsset(VALE_PCD_LOGO_URL),
    loadStaticTemplateAsset(VALE_PCD_SKYLINE_URL),
    loadImageForCanvas(params.photoUrl),
    params.isResolved && params.resolvedPhotoUrl
      ? loadImageForCanvas(params.resolvedPhotoUrl)
      : Promise.resolve(null)
  ]);

  const marginX = 56;

  // 2. Silhueta lilás dos prédios à direita (atrás da linha divisória superior)
  if (skylineImg) {
    const skyW = isVerticalStory ? 372 : 304;
    const skyH = Math.round(skyW * (438 / 411));
    const skyX = W - skyW + 4;
    const skyY = isVerticalStory ? 268 : 148;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.drawImage(skylineImg, skyX, skyY, skyW, skyH);
    ctx.restore();
  }

  // 3. Logo oficial Vale PCD (borboleta roxa + vale PCD) no canto superior direito
  if (logoImg) {
    const logoW = isVerticalStory ? 286 : 244;
    const logoH = Math.round(logoW * (387 / 714));
    const logoX = W - 62 - logoW;
    const logoY = isVerticalStory ? 122 : 52;
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  }

  // 4. Barra curta roxa superior esquerda + Título "Hoje em / {Cidade}" em itálico
  const topBarY = isVerticalStory ? 136 : 64;
  const topBarW = isVerticalStory ? 98 : 84;
  const topBarH = isVerticalStory ? 6 : 5;
  ctx.fillStyle = BRAND_PURPLE;
  ctx.fillRect(marginX + 4, topBarY, topBarW, topBarH);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#050505';
  ctx.font = `italic 400 ${isVerticalStory ? 90 : 68}px ${VALE_PCD_FONT_STACK}`;
  ctx.fillText('Hoje em', marginX, isVerticalStory ? 262 : 164);

  const cleanCity = String(params.cidade || 'Sua Cidade').trim();
  const maxCitySingleW = W - marginX * 2;
  const cityMaxPx = isVerticalStory ? 84 : 66;
  const cityMinPx = isVerticalStory ? 38 : 34;
  const cityFontPx = fitFontSizeWithStyle(
    ctx,
    cleanCity,
    'italic 800',
    VALE_PCD_FONT_STACK,
    cityMaxPx,
    cityMinPx,
    maxCitySingleW
  );

  ctx.font = `italic 800 ${cityFontPx}px ${VALE_PCD_FONT_STACK}`;
  ctx.fillStyle = BRAND_PURPLE;
  const cityLines = wrapCanvasText(ctx, cleanCity, maxCitySingleW, 2);
  let cityBaselineY = isVerticalStory ? 372 : 246;
  for (const line of cityLines) {
    ctx.fillText(line, marginX, cityBaselineY);
    cityBaselineY += Math.round(cityFontPx * 1.12);
  }

  // 5. Linha de endereço limpa (ex.: "Av. teste, 256 - bairro X") + Linha horizontal roxa superior
  const cleanAddr =
    String(params.addressLine || '').trim() || 'Localização registrada no Multei';
  const topDividerY = isVerticalStory ? 624 : 386;
  const addrMaxW = W - marginX * 2;
  const addrFontPx = fitFontSizeWithStyle(
    ctx,
    cleanAddr,
    '400',
    VALE_PCD_FONT_STACK,
    isVerticalStory ? 42 : 33,
    22,
    addrMaxW
  );

  ctx.font = `400 ${addrFontPx}px ${VALE_PCD_FONT_STACK}`;
  ctx.fillStyle = '#070707';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const addrWrapped = wrapCanvasText(ctx, cleanAddr, addrMaxW, 1);
  if (addrWrapped[0]) {
    ctx.fillText(addrWrapped[0], marginX, topDividerY - (isVerticalStory ? 32 : 24));
  }

  const lineThickness = isVerticalStory ? 4.5 : 4;
  ctx.fillStyle = BRAND_PURPLE;
  ctx.fillRect(marginX, topDividerY, W - marginX * 2, lineThickness);

  // 6. Quadro da foto + Linha horizontal roxa inferior
  // Nos Stories com marcação @, reduz um pouco a foto na base e coloca o @ discreto logo abaixo
  const sanitizedHandles = isVerticalStory ? sanitizeStoryTagHandles(params.tagHandles) : [];
  const bottomSpaceBelowLine = isVerticalStory
    ? sanitizedHandles.length > 0
      ? 110
      : 52
    : 36;
  const bottomDividerY = BODY_H - bottomSpaceBelowLine;

  const matPad = isVerticalStory ? 18 : 14;
  const matX = marginX;
  const matY = topDividerY + lineThickness + (isVerticalStory ? 14 : 10);
  const matW = W - marginX * 2;
  const matH = bottomDividerY - (isVerticalStory ? 14 : 10) - matY;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.06)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(matX, matY, matW, matH);
  ctx.restore();

  const photoX = matX + matPad;
  const photoY = matY + matPad;
  const photoW = matW - matPad * 2;
  const photoH = matH - matPad * 2;

  if (params.isResolved && afterImg) {
    const colGap = 12;
    const colW = (photoW - colGap) / 2;
    const leftX = photoX;
    const rightX = photoX + colW + colGap;

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(leftX, photoY, colW, photoH);
    if (mainOrBeforeImg) {
      drawImageSmartInFrame(ctx, mainOrBeforeImg, leftX, photoY, colW, photoH, 2, true, params.crop);
    }

    const beforeTagText = 'ANTES';
    ctx.font = `700 22px ${VALE_PCD_FONT_STACK}`;
    const bW = ctx.measureText(beforeTagText).width + 36;
    const bH = 42;
    const bX = leftX + 16;
    const bY = photoY + 16;
    drawRoundedRectPath(ctx, bX, bY, bW, bH, 21);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(beforeTagText, bX + bW / 2, bY + bH / 2 + 1);

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(rightX, photoY, colW, photoH);
    drawImageSmartInFrame(
      ctx,
      afterImg,
      rightX,
      photoY,
      colW,
      photoH,
      2,
      true,
      params.resolvedCrop || params.crop
    );

    const afterTagText = '✓ RESOLVIDO';
    ctx.font = `700 22px ${VALE_PCD_FONT_STACK}`;
    const aW = ctx.measureText(afterTagText).width + 36;
    const aH = 42;
    const aX = rightX + 16;
    const aY = photoY + 16;
    drawRoundedRectPath(ctx, aX, aY, aW, aH, 21);
    ctx.fillStyle = 'rgba(22, 163, 74, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(afterTagText, aX + aW / 2, aY + aH / 2 + 1);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    if (mainOrBeforeImg) {
      drawImageSmartInFrame(ctx, mainOrBeforeImg, photoX, photoY, photoW, photoH, 2, true, params.crop);
    }
  }

  // Linha horizontal roxa inferior
  ctx.fillStyle = BRAND_PURPLE;
  ctx.fillRect(marginX, bottomDividerY, W - marginX * 2, lineThickness);

  // Marcação @ discreta logo abaixo da foto/linha (apenas em Stories quando houver @)
  let userTags: InstagramStoryUserTagPoint[] = [];
  if (sanitizedHandles.length > 0) {
    const tagCenterY = bottomDividerY + lineThickness + (BODY_H - (bottomDividerY + lineThickness)) / 2;
    userTags = drawDiscreetStoryMentionPills(
      ctx,
      W,
      H,
      tagCenterY,
      sanitizedHandles,
      VALE_PCD_FONT_STACK
    );
  }

  // 7. Rodapé roxo sólido com texto / endereço editável
  ctx.fillStyle = BRAND_FOOTER_PURPLE;
  ctx.fillRect(0, BODY_H, W, FOOTER_H);

  const cityFooterRaw =
    params.footerUrlText !== undefined
      ? String(params.footerUrlText).trim()
      : 'www.valepcd.com.br/multei';

  if (cityFooterRaw) {
    const cityFooterFontPx = fitFontSizeWithStyle(
      ctx,
      cityFooterRaw,
      '700',
      VALE_PCD_FONT_STACK,
      isVerticalStory ? 44 : 38,
      20,
      W - 80
    );
    ctx.font = `700 ${cityFooterFontPx}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cityFooterRaw, W / 2, BODY_H + FOOTER_H / 2 + 2);
  }

  return { canvas, userTags };
}

function drawReportMetricVectorIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'document' | 'bus' | 'cone' | 'check',
  cx: number,
  cy: number,
  outerRadius: number
): void {
  // Anel duplo cinza claro fiel ao template
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#EBEBEB';
  ctx.fill();

  const innerR = Math.round(outerRadius * 0.8);
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#F7F7F7';
  ctx.fill();

  const iconColor = '#404040';
  const s = outerRadius / 62; // fator de escala base

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  if (kind === 'document') {
    // Folha com canto superior direito dobrado + linhas horizontais
    const w = 46;
    const h = 58;
    const fold = 14;
    const x0 = -w / 2;
    const y0 = -h / 2;

    ctx.beginPath();
    ctx.moveTo(x0 + 6, y0);
    ctx.lineTo(x0 + w - fold, y0);
    ctx.lineTo(x0 + w, y0 + fold);
    ctx.lineTo(x0 + w, y0 + h - 6);
    ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - 6, y0 + h);
    ctx.lineTo(x0 + 6, y0 + h);
    ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - 6);
    ctx.lineTo(x0, y0 + 6);
    ctx.quadraticCurveTo(x0, y0, x0 + 6, y0);
    ctx.closePath();
    ctx.fillStyle = iconColor;
    ctx.fill();

    // Dobra branca no canto
    ctx.beginPath();
    ctx.moveTo(x0 + w - fold, y0 + 2);
    ctx.lineTo(x0 + w - fold, y0 + fold);
    ctx.lineTo(x0 + w - 2, y0 + fold);
    ctx.closePath();
    ctx.fillStyle = '#F7F7F7';
    ctx.fill();

    // Linhas internas do documento
    ctx.strokeStyle = '#F7F7F7';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const lineYs = [-8, 3, 14, 23];
    for (let i = 0; i < lineYs.length; i++) {
      const ly = lineYs[i];
      ctx.beginPath();
      ctx.moveTo(x0 + 10, ly);
      ctx.lineTo(i === 3 ? x0 + w - 18 : x0 + w - 10, ly);
      ctx.stroke();
    }
  } else if (kind === 'bus') {
    // Ônibus urbano frontal
    drawRoundedRectPath(ctx, -23, -27, 46, 46, 9);
    ctx.fillStyle = iconColor;
    ctx.fill();

    // Retrovisores laterais
    drawRoundedRectPath(ctx, -30, -14, 5, 13, 2.5);
    ctx.fill();
    drawRoundedRectPath(ctx, 25, -14, 5, 13, 2.5);
    ctx.fill();

    // Rodas inferiores
    drawRoundedRectPath(ctx, -19, 17, 9, 10, 3);
    ctx.fill();
    drawRoundedRectPath(ctx, 10, 17, 9, 10, 3);
    ctx.fill();

    // Letreiro superior e para-brisa claros
    drawRoundedRectPath(ctx, -13, -22, 26, 5, 2.5);
    ctx.fillStyle = '#F7F7F7';
    ctx.fill();

    drawRoundedRectPath(ctx, -18, -13, 36, 17, 4);
    ctx.fill();

    // Faróis redondos
    ctx.beginPath();
    ctx.arc(-13, 11, 3.6, 0, Math.PI * 2);
    ctx.arc(13, 11, 3.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cone') {
    // Cone de trânsito listrado com base
    drawRoundedRectPath(ctx, -28, 20, 56, 8, 4);
    ctx.fillStyle = iconColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-6, -27);
    ctx.lineTo(6, -27);
    ctx.lineTo(20, 20);
    ctx.lineTo(-20, 20);
    ctx.closePath();
    ctx.fill();

    // Duas faixas reflexivas claras
    ctx.fillStyle = '#F7F7F7';
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(10, -12);
    ctx.lineTo(12.5, -4);
    ctx.lineTo(-12.5, -4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-14.5, 4);
    ctx.lineTo(14.5, 4);
    ctx.lineTo(17, 12);
    ctx.lineTo(-17, 12);
    ctx.closePath();
    ctx.fill();
  } else {
    // Círculo sólido escuro com check claro
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fillStyle = iconColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-12, 1);
    ctx.lineTo(-3, 10);
    ctx.lineTo(13, -8);
    ctx.strokeStyle = '#F7F7F7';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renderiza o template oficial do Relatório Geral ("Cidades mais acessíveis acontecem aqui")
 * em `1080x1920` (Stories 9:16) ou `1080x1350` (Feed 4:5).
 * Oculta o 4º card quando `resolvidos === 0` e posiciona a marcação `@` discreta nos Stories
 * logo abaixo da segunda fileira de cards.
 */
async function renderValePcdGeneralReportCanvas(params: {
  aspect: '9:16' | '4:5';
  title: string;
  totalGeral: number;
  cidadesCount: number;
  infracoesTransito: number;
  mobilidadeUrbana: number;
  resolvidos: number;
  tagHandles?: string[];
  footerMessageText?: string;
  footerUrlText?: string;
}): Promise<{ canvas: HTMLCanvasElement; userTags: InstagramStoryUserTagPoint[] }> {
  await ensureCanvasFontsReady();

  const isVerticalStory = params.aspect === '9:16';
  const W = 1080;
  const H = isVerticalStory ? 1920 : 1350;
  const FOOTER_H = isVerticalStory ? 248 : 194;
  const BODY_H = H - FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D indisponível para renderizar o relatório geral.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const [logoImg, skylineImg, streetBwImg] = await Promise.all([
    loadStaticTemplateAsset(VALE_PCD_LOGO_URL),
    loadStaticTemplateAsset(VALE_PCD_SKYLINE_URL),
    loadStaticTemplateAsset(VALE_PCD_REPORT_STREET_URL)
  ]);

  // 1. Fundo superior claro
  ctx.fillStyle = '#FAFAFB';
  ctx.fillRect(0, 0, W, BODY_H);

  // Geometria dos cards para alinhar o início da foto P&B exatamente no meio da 2ª fileira
  const marginX = 58;
  const colGap = 32;
  const cardW = (W - marginX * 2 - colGap) / 2; // 466
  const cardH = isVerticalStory ? 236 : 186;
  const rowGap = isVerticalStory ? 34 : 22;
  const row1Y = isVerticalStory ? 468 : 352;
  const row2Y = row1Y + cardH + rowGap;

  // 2. Foto P&B da rua acessível na metade inferior (começando atrás da metade da 2ª fileira de cards)
  const streetTopY = Math.round(row2Y + cardH * 0.44);
  const streetH = BODY_H - streetTopY;
  if (streetBwImg && streetH > 40) {
    drawCoverImageInRect(
      ctx,
      streetBwImg,
      0,
      streetTopY,
      W,
      streetH,
      isVerticalStory ? 0.42 : 0.62
    );
  } else {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, streetTopY, W, streetH);
  }

  // 3. Ilustração lilás dos prédios à direita (atrás da 1ª fileira de cards)
  if (skylineImg) {
    const skyW = isVerticalStory ? 360 : 292;
    const skyH = Math.round(skyW * (438 / 411));
    const skyX = W - skyW + 6;
    const skyY = isVerticalStory ? 228 : 138;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(skylineImg, skyX, skyY, skyW, skyH);
    ctx.restore();
  }

  // 4. Logo oficial Vale PCD no topo direito
  if (logoImg) {
    const logoW = isVerticalStory ? 268 : 232;
    const logoH = Math.round(logoW * (387 / 714));
    const logoX = W - 62 - logoW;
    const logoY = isVerticalStory ? 96 : 44;
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  }

  // 5. Barra curta roxa + Título em 3 linhas + Subtítulo "Registros mapeados em X cidades"
  const topBarY = isVerticalStory ? 104 : 52;
  ctx.fillStyle = BRAND_PURPLE;
  ctx.fillRect(marginX + 6, topBarY, isVerticalStory ? 88 : 78, isVerticalStory ? 6 : 5);

  const rawTitle = String(params.title || 'Cidades mais acessíveis acontecem aqui').trim();
  const normalizedDefault = rawTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const titleFontSize = isVerticalStory ? 68 : 54;
  const titleLineStep = isVerticalStory ? 78 : 62;
  const titleFirstBaselineY = isVerticalStory ? 196 : 128;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (
    !rawTitle ||
    normalizedDefault === 'cidades mais acessiveis acontecem aqui'
  ) {
    ctx.font = `400 ${titleFontSize}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = '#050505';
    ctx.fillText('Cidades mais', marginX, titleFirstBaselineY);

    ctx.font = `800 ${titleFontSize}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = BRAND_PURPLE;
    ctx.fillText('acessíveis', marginX, titleFirstBaselineY + titleLineStep);

    ctx.font = `400 ${titleFontSize}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = '#050505';
    ctx.fillText('acontecem aqui', marginX, titleFirstBaselineY + titleLineStep * 2);
  } else {
    // Caso o Admin personalize o título, mantém a mesma hierarquia visual com destaque em roxo
    ctx.font = `700 ${isVerticalStory ? 60 : 48}px ${VALE_PCD_FONT_STACK}`;
    const customLines = wrapCanvasText(ctx, rawTitle, 640, 3);
    let cy = titleFirstBaselineY + (customLines.length < 3 ? Math.round(titleLineStep * 0.45) : 0);
    customLines.forEach((ln, idx) => {
      const isHighlight = customLines.length === 1 || idx === 1 || (customLines.length === 2 && idx === 1);
      ctx.font = `${isHighlight ? 800 : 400} ${isVerticalStory ? 60 : 48}px ${VALE_PCD_FONT_STACK}`;
      ctx.fillStyle = isHighlight ? BRAND_PURPLE : '#050505';
      ctx.fillText(ln, marginX, cy);
      cy += isVerticalStory ? 72 : 58;
    });
  }

  const citiesCount = Math.max(0, Math.floor(params.cidadesCount));
  const citiesWord = citiesCount === 1 ? 'cidade' : 'cidades';
  ctx.font = `700 ${isVerticalStory ? 34 : 28}px ${VALE_PCD_FONT_STACK}`;
  ctx.fillStyle = '#575757';
  ctx.fillText(
    `Registros mapeados em ${citiesCount} ${citiesWord}`,
    marginX,
    isVerticalStory ? 412 : 310
  );

  // 6. Cards de indicadores (2x2 quando resolvidos >= 1; sem o 4º card quando resolvidos === 0)
  const drawReportCard = (
    cx: number,
    cy: number,
    iconKind: 'document' | 'bus' | 'cone' | 'check',
    value: number,
    label1: string,
    label2: string
  ) => {
    const r = 28;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    drawRoundedRectPath(ctx, cx, cy, cardW, cardH, r);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    // Faixa superior roxa característica no topo de cada card
    drawRoundedRectPath(ctx, cx + 18, cy, cardW - 36, isVerticalStory ? 7 : 6, 3.5);
    ctx.fillStyle = BRAND_PURPLE;
    ctx.fill();

    const circleOuterR = isVerticalStory ? 62 : 50;
    const circleCx = cx + (isVerticalStory ? 96 : 80);
    const circleCy = cy + cardH / 2 + 2;
    drawReportMetricVectorIcon(ctx, iconKind, circleCx, circleCy, circleOuterR);

    const textStartX = circleCx + circleOuterR + (isVerticalStory ? 28 : 22);
    const maxNumW = cx + cardW - textStartX - 20;
    const valStr = String(Math.max(0, Math.floor(value)));
    const numFontPx = fitFontSizeWithStyle(
      ctx,
      valStr,
      'italic 400',
      VALE_PCD_FONT_STACK,
      isVerticalStory ? 78 : 62,
      36,
      maxNumW
    );

    ctx.font = `italic 400 ${numFontPx}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = '#6D0066';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(valStr, textStartX, cy + (isVerticalStory ? 116 : 92));

    const lblPx = isVerticalStory ? 29 : 24;
    ctx.font = `400 ${lblPx}px ${VALE_PCD_FONT_STACK}`;
    ctx.fillStyle = '#121212';
    ctx.fillText(label1, textStartX, cy + (isVerticalStory ? 164 : 132));
    ctx.fillText(label2, textStartX, cy + (isVerticalStory ? 200 : 162));
  };

  // Fileira 1: Total de denúncias (totalGeral) | Mobilidade Urbana
  drawReportCard(
    marginX,
    row1Y,
    'document',
    params.totalGeral,
    'Total de',
    'denúncias'
  );
  drawReportCard(
    marginX + cardW + colGap,
    row1Y,
    'bus',
    params.mobilidadeUrbana,
    'Mobilidade',
    'Urbana'
  );

  // Fileira 2: Denúncias de Trânsito | Problema(s) Resolvido(s) (somente se >= 1)
  const hasResolved = params.resolvidos >= 1;
  if (hasResolved) {
    drawReportCard(
      marginX,
      row2Y,
      'cone',
      params.infracoesTransito,
      'Denúncias',
      'de Trânsito'
    );
    const isSingular = Math.floor(params.resolvidos) === 1;
    drawReportCard(
      marginX + cardW + colGap,
      row2Y,
      'check',
      params.resolvidos,
      isSingular ? 'Problema' : 'Problemas',
      isSingular ? 'Resolvido' : 'Resolvidos'
    );
  } else {
    drawReportCard(
      marginX,
      row2Y,
      'cone',
      params.infracoesTransito,
      'Denúncias',
      'de Trânsito'
    );
  }

  // 7. Marcação @ discreta nos Stories logo abaixo da região dos cards (com ou sem Problemas Resolvidos)
  const sanitizedHandles = isVerticalStory ? sanitizeStoryTagHandles(params.tagHandles) : [];
  let userTags: InstagramStoryUserTagPoint[] = [];
  if (sanitizedHandles.length > 0) {
    const cardsBottomY = row2Y + cardH;
    const tagCenterY = cardsBottomY + 42;
    userTags = drawDiscreetStoryMentionPills(
      ctx,
      W,
      H,
      tagCenterY,
      sanitizedHandles,
      VALE_PCD_FONT_STACK
    );
  }

  // 8. Rodapé roxo institucional editável
  ctx.fillStyle = BRAND_FOOTER_PURPLE;
  ctx.fillRect(0, BODY_H, W, FOOTER_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';

  const defaultReportMsg =
    'Com seu apoio e denúncia 100% anônima podemos juntos criar cidades mais acessíveis!';
  const rawReportMsg =
    params.footerMessageText !== undefined
      ? String(params.footerMessageText).trim()
      : defaultReportMsg;
  const rawReportUrl =
    params.footerUrlText !== undefined
      ? String(params.footerUrlText).trim()
      : 'www.valepcd.com.br/multei';

  const fLinePx = isVerticalStory ? 31 : 27;
  ctx.font = `400 ${fLinePx}px ${VALE_PCD_FONT_STACK}`;

  let msgLines: string[] = [];
  if (rawReportMsg) {
    const manualSplit = rawReportMsg
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (manualSplit.length >= 2) {
      msgLines = manualSplit.slice(0, 2);
    } else if (rawReportMsg === defaultReportMsg) {
      msgLines = [
        'Com seu apoio e denúncia 100% anônima',
        'podemos juntos criar cidades mais acessíveis!'
      ];
    } else {
      msgLines = wrapCanvasText(ctx, rawReportMsg, W - 96, 2);
    }
  }

  if (msgLines.length === 2) {
    ctx.fillText(msgLines[0], W / 2, BODY_H + (isVerticalStory ? 84 : 62));
    ctx.fillText(msgLines[1], W / 2, BODY_H + (isVerticalStory ? 128 : 98));
    if (rawReportUrl) {
      const urlPx = fitFontSizeWithStyle(
        ctx,
        rawReportUrl,
        '700',
        VALE_PCD_FONT_STACK,
        isVerticalStory ? 38 : 33,
        20,
        W - 80
      );
      ctx.font = `700 ${urlPx}px ${VALE_PCD_FONT_STACK}`;
      ctx.fillText(rawReportUrl, W / 2, BODY_H + (isVerticalStory ? 182 : 144));
    }
  } else if (msgLines.length === 1) {
    ctx.fillText(msgLines[0], W / 2, BODY_H + (isVerticalStory ? 102 : 76));
    if (rawReportUrl) {
      const urlPx = fitFontSizeWithStyle(
        ctx,
        rawReportUrl,
        '700',
        VALE_PCD_FONT_STACK,
        isVerticalStory ? 38 : 33,
        20,
        W - 80
      );
      ctx.font = `700 ${urlPx}px ${VALE_PCD_FONT_STACK}`;
      ctx.fillText(rawReportUrl, W / 2, BODY_H + (isVerticalStory ? 162 : 128));
    }
  } else if (rawReportUrl) {
    const urlPx = fitFontSizeWithStyle(
      ctx,
      rawReportUrl,
      '700',
      VALE_PCD_FONT_STACK,
      isVerticalStory ? 42 : 36,
      20,
      W - 80
    );
    ctx.font = `700 ${urlPx}px ${VALE_PCD_FONT_STACK}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(rawReportUrl, W / 2, BODY_H + FOOTER_H / 2 + 2);
  }

  return { canvas, userTags };
}

const FOOTER_PREFS_STORAGE_KEY = 'multei_ig_footer_prefs_v1';

export interface MulteiEditableFooterPrefs {
  cityFooterUrl: string;
  reportFooterMessage: string;
  reportFooterUrl: string;
}

export function readSavedMulteiFooterPrefs(): MulteiEditableFooterPrefs {
  const defaults: MulteiEditableFooterPrefs = {
    cityFooterUrl: 'www.valepcd.com.br/multei',
    reportFooterMessage:
      'Com seu apoio e denúncia 100% anônima podemos juntos criar cidades mais acessíveis!',
    reportFooterUrl: 'www.valepcd.com.br/multei'
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(FOOTER_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MulteiEditableFooterPrefs>;
    return {
      cityFooterUrl:
        typeof parsed.cityFooterUrl === 'string' ? parsed.cityFooterUrl : defaults.cityFooterUrl,
      reportFooterMessage:
        typeof parsed.reportFooterMessage === 'string'
          ? parsed.reportFooterMessage
          : defaults.reportFooterMessage,
      reportFooterUrl:
        typeof parsed.reportFooterUrl === 'string'
          ? parsed.reportFooterUrl
          : defaults.reportFooterUrl
    };
  } catch {
    return defaults;
  }
}

export function saveMulteiFooterPrefs(prefs: Partial<MulteiEditableFooterPrefs>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readSavedMulteiFooterPrefs();
    const next: MulteiEditableFooterPrefs = {
      cityFooterUrl:
        prefs.cityFooterUrl !== undefined
          ? String(prefs.cityFooterUrl).slice(0, 120)
          : current.cityFooterUrl,
      reportFooterMessage:
        prefs.reportFooterMessage !== undefined
          ? String(prefs.reportFooterMessage).slice(0, 180)
          : current.reportFooterMessage,
      reportFooterUrl:
        prefs.reportFooterUrl !== undefined
          ? String(prefs.reportFooterUrl).slice(0, 120)
          : current.reportFooterUrl
    };
    window.localStorage.setItem(FOOTER_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function buildShareCardFilename(options: IncidentShareCardOptions, isPng: boolean): string {
  const nat = String(options.natureza || '').trim().toLowerCase();
  const verif = String(options.verificacao || '').trim().toLowerCase();

  let tipo = 'Infração de Trânsito';
  if (options.isResolved) {
    tipo = 'Mobilidade Resolvido';
  } else if (nat === 'urbana') {
    tipo = 'Mobilidade Urbana';
  } else if (verif.includes('exclusiva')) {
    tipo = 'Vaga Exclusiva PcD';
  } else if (verif.includes('transferencia')) {
    tipo = 'Área de Transferência';
  } else if (verif.includes('pedestre')) {
    tipo = 'Faixa de Pedestres';
  }

  let cidade = String(options.cidade || '').trim();
  if (!cidade && options.locationText) {
    const parts = options.locationText.split('•').map((s) => s.trim());
    if (parts.length > 1) {
      cidade = parts[parts.length - 1].split('-')[0].trim();
    }
  }

  const rawDate = options.timestamp ? new Date(options.timestamp) : new Date();
  const validDate = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const dd = String(validDate.getDate()).padStart(2, '0');
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const yyyy = String(validDate.getFullYear());
  const dateFormatted = `${dd}_${mm}_${yyyy}`;

  const segments = ['Ocorrencia', tipo, cidade, dateFormatted].filter(Boolean);
  const safeBase = segments
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `${safeBase}.${isPng ? 'png' : 'jpg'}`;
}

function triggerCardDownload(file: File) {
  if (typeof document === 'undefined') return;
  const objUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objUrl;
  link.download = file.name || 'Ocorrencia.jpg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

export function downloadGeneratedCardFile(file: File): void {
  triggerCardDownload(file);
}

const BRAZIL_STATE_NAME_TO_UF: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO'
};

function normalizeBrazilUfSigla(raw?: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const key = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return BRAZIL_STATE_NAME_TO_UF[key] || '';
}

function formatCityWithUfSigla(cidadeRaw?: string, estadoRaw?: string): string {
  const cleanCity = String(cidadeRaw || '')
    .trim()
    .replace(/\s*[-/]\s*[a-zA-Z]{2}$/, '')
    .trim();
  const uf = normalizeBrazilUfSigla(estadoRaw);
  if (!cleanCity) return 'Sua Cidade';
  return uf ? `${cleanCity} - ${uf}` : cleanCity;
}

/**
 * Gera o card visual de compartilhamento no mapa `/multei` (1080x1920, 9:16) usando o novo template "Hoje em {Cidade} - {UF}".
 */
export async function generateIncidentShareCardFile(
  options: IncidentShareCardOptions,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<File> {
  const rawLoc = String(options.locationText || '').trim();
  const locSegments = rawLoc
    .split('•')
    .map((s) => s.trim())
    .filter(Boolean);

  let parsedCity = String(options.cidade || '').trim();
  let parsedUf = normalizeBrazilUfSigla(options.estado);

  if (locSegments.length > 1) {
    const tailParts = locSegments[locSegments.length - 1].split('-').map((p) => p.trim());
    if (!parsedCity && tailParts[0]) {
      parsedCity = tailParts[0];
    }
    if (!parsedUf && tailParts.length > 1) {
      parsedUf = normalizeBrazilUfSigla(tailParts[tailParts.length - 1]);
    }
  }

  const cityDisplay = formatCityWithUfSigla(parsedCity, parsedUf);
  const streetPart =
    locSegments.length > 0 ? locSegments[0] : rawLoc || 'Local registrado no Multei';

  const primaryPhotoUrl = options.photoUrl || options.photoSrc || '';
  const resolvedAfterUrl = options.resolvedPhotoUrl || options.afterPhotoSrc || '';
  const savedPrefs = readSavedMulteiFooterPrefs();

  const { canvas } = await renderValePcdCityOccurrenceCanvas({
    aspect: '9:16',
    cidade: cityDisplay,
    addressLine: streetPart,
    photoUrl: primaryPhotoUrl,
    resolvedPhotoUrl: resolvedAfterUrl,
    isResolved: options.isResolved,
    footerUrlText: savedPrefs.cityFooterUrl
  });

  const isPng = mimeType === 'image/png';
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar card de compartilhamento.'))),
      isPng ? 'image/png' : 'image/jpeg',
      isPng ? undefined : 0.93
    );
  });

  const fileName = buildShareCardFilename(options, isPng);
  return new File([blob], fileName, { type: isPng ? 'image/png' : 'image/jpeg' });
}

export async function shareIncidentWithTemplate(
  options: IncidentShareCardOptions
): Promise<{
  status: 'shared' | 'copied' | 'downloaded' | 'cancelled';
  shared: boolean;
  method: 'web-share' | 'clipboard-image' | 'download';
  shareUrl: string;
}> {
  const token = encodeIncidentShareToken(options.latitude, options.longitude, options.timestamp);
  const shareUrl = token
    ? `https://www.valepcd.com.br/multei?p=${encodeURIComponent(token)}`
    : 'https://www.valepcd.com.br/multei';

  const file = await generateIncidentShareCardFile(options, 'image/jpeg');
  triggerCardDownload(file);

  return { status: 'downloaded', shared: true, method: 'download', shareUrl };
}

/**
 * Gera um slide `1080x1350` (4:5 Feed) na Fase 1 usando o template oficial "Hoje em {Cidade} - {UF}".
 */
export async function generateInstagramCarouselSlideFile(
  options: InstagramCarouselSlideOptions
): Promise<File> {
  const cleanRua = String(options.rua || '').trim();
  const cleanBairro = String(options.bairro || '').trim();
  const cleanCidade = String(options.cidade || 'Cidade').trim();
  const cityWithUf = formatCityWithUfSigla(cleanCidade, options.estado);
  const streetParts = [cleanRua, cleanBairro].filter(Boolean);
  const addressLine =
    streetParts.length > 0 ? streetParts.join(' - ') : 'Local registrado no Multei';

  const { canvas } = await renderValePcdCityOccurrenceCanvas({
    aspect: '4:5',
    cidade: cityWithUf,
    addressLine,
    photoUrl: options.photoUrl,
    resolvedPhotoUrl: options.resolvedPhotoUrl,
    isResolved: options.isResolved,
    footerUrlText: options.footerUrlText,
    crop: options.crop,
    resolvedCrop: options.resolvedCrop
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar slide do Instagram.'))),
      'image/jpeg',
      0.93
    );
  });

  const safeCity = cleanCidade.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return new File([blob], `multei_ig_${safeCity}_slide_${options.slideIndex + 1}.jpg`, {
    type: 'image/jpeg'
  });
}

/**
 * Gera um slide `1080x1920` (9:16 Stories) na Fase 1 usando o template oficial "Hoje em {Cidade} - {UF}".
 */
export async function generateInstagramStorySlideWithTags(
  options: InstagramStorySlideOptions
): Promise<{ file: File; userTags: InstagramStoryUserTagPoint[] }> {
  const cleanRua = String(options.rua || '').trim();
  const cleanBairro = String(options.bairro || '').trim();
  const cleanCidade = String(options.cidade || 'Cidade').trim();
  const cityWithUf = formatCityWithUfSigla(cleanCidade, options.estado);
  const streetParts = [cleanRua, cleanBairro].filter(Boolean);
  const addressLine =
    streetParts.length > 0 ? streetParts.join(' - ') : 'Local registrado no Multei';

  const { canvas, userTags } = await renderValePcdCityOccurrenceCanvas({
    aspect: '9:16',
    cidade: cityWithUf,
    addressLine,
    photoUrl: options.photoUrl,
    resolvedPhotoUrl: options.resolvedPhotoUrl,
    isResolved: options.isResolved,
    tagHandles: options.tagHandles,
    footerUrlText: options.footerUrlText,
    crop: options.crop,
    resolvedCrop: options.resolvedCrop
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar Story do Instagram.'))),
      'image/jpeg',
      0.93
    );
  });

  const safeCity = cleanCidade.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const file = new File(
    [blob],
    `multei_story_${safeCity}_slide_${options.slideIndex + 1}.jpg`,
    {
      type: 'image/jpeg'
    }
  );

  return { file, userTags };
}

/**
 * Gera a arte `1080x1350` (4:5 Feed) do Relatório Geral ("Cidades mais acessíveis acontecem aqui").
 */
export async function generateInstagramGeneralReportFile(
  options: InstagramGeneralReportCardOptions
): Promise<File> {
  const { canvas } = await renderValePcdGeneralReportCanvas({
    aspect: '4:5',
    title: options.title,
    totalGeral: options.totalGeral,
    cidadesCount: options.cidadesCount,
    infracoesTransito: options.infracoesTransito,
    mobilidadeUrbana: options.mobilidadeUrbana,
    resolvidos: options.resolvidos,
    footerMessageText: options.footerMessageText,
    footerUrlText: options.footerUrlText
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar card do relatório geral.'))),
      'image/jpeg',
      0.93
    );
  });

  return new File([blob], 'multei_relatorio_instagram.jpg', {
    type: 'image/jpeg'
  });
}

/**
 * Gera a arte `1080x1920` (9:16 Stories) do Relatório Geral ("Cidades mais acessíveis acontecem aqui").
 */
export async function generateInstagramGeneralReportStoryWithTags(
  options: InstagramGeneralReportStoryOptions
): Promise<{ file: File; userTags: InstagramStoryUserTagPoint[] }> {
  const { canvas, userTags } = await renderValePcdGeneralReportCanvas({
    aspect: '9:16',
    title: options.title,
    totalGeral: options.totalGeral,
    cidadesCount: options.cidadesCount,
    infracoesTransito: options.infracoesTransito,
    mobilidadeUrbana: options.mobilidadeUrbana,
    resolvidos: options.resolvidos,
    tagHandles: options.tagHandles,
    footerMessageText: options.footerMessageText,
    footerUrlText: options.footerUrlText
  });

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error('Falha ao exportar Story do relatório geral.')),
      'image/jpeg',
      0.93
    );
  });

  const file = new File([blob], 'multei_relatorio_story_instagram.jpg', {
    type: 'image/jpeg'
  });

  return { file, userTags };
}