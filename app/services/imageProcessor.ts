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

async function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
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
  alwaysCover = false
) {
  ctx.save();
  drawRoundedRectPath(ctx, fx, fy, fw, fh, radius);
  ctx.clip();

  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const imgRatio = iw / ih;
  const frameRatio = fw / fh;

  const coverScale = Math.max(fw / iw, fh / ih);
  const coverW = iw * coverScale;
  const coverH = ih * coverScale;
  const coverX = fx + (fw - coverW) / 2;
  const coverY = fy + (fh - coverH) / 2;

  const ratioDiff = Math.abs(imgRatio - frameRatio) / frameRatio;

  if (alwaysCover || ratioDiff <= 0.38) {
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

/**
 * Gera o card visual de compartilhamento (1080x1920, proporção 9:16 Stories) para WhatsApp e Instagram.
 */
export async function generateIncidentShareCardFile(
  options: IncidentShareCardOptions,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<File> {
  const W = 1080;
  const H = 1920;
  const FOOTER_H = 264;
  const BODY_H = H - FOOTER_H; // 1656

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D indisponível para gerar o card de compartilhamento.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Fundo claro lavanda suave (Opção 2 aprovada)
  const bgGrad = ctx.createLinearGradient(0, 0, W, BODY_H);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(0.5, '#f5f0ff');
  bgGrad.addColorStop(1, '#f3e3fa');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, BODY_H);

  // Brilho lateral suave lavanda
  const glowRight = ctx.createRadialGradient(W * 0.92, BODY_H * 0.52, 40, W * 0.92, BODY_H * 0.52, 640);
  glowRight.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
  glowRight.addColorStop(1, 'rgba(192, 132, 252, 0)');
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, W, BODY_H);

  const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // 2. Selo superior "VALE PCD"
  // Quando a aplicação for liberada para todo o público, voltar para: const pillText = 'MULTEI • VALE PCD';
  const pillText = 'VALE PCD';
  ctx.font = `700 26px ${fontStack}`;
  const pillTextW = ctx.measureText(pillText).width;
  const pillW = pillTextW + 64;
  const pillH = 56;
  const pillX = (W - pillW) / 2;
  const pillY = 76;

  drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 28);
  ctx.fillStyle = 'rgba(237, 233, 254, 0.9)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(134, 0, 125, 0.18)';
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, W / 2, pillY + pillH / 2 + 1);

  // 3. Título Principal ("Denúncia de <Tipo>" ou "Problema de Mobilidade Resolvido") com ícone reduzido proporcional
  const headline = getShareHeadlineInfo(options);
  ctx.font = `800 64px ${fontStack}`;
  ctx.fillStyle = '#070b19';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(headline.line1, W / 2, 214);

  const line2Width = ctx.measureText(headline.line2).width;
  const badgeSize = 46; // Ícone discreto e menor que a caixa alta do título
  const badgeGap = 16;
  const totalLine2W = line2Width + badgeGap + badgeSize;
  const line2StartX = (W - totalLine2W) / 2;
  const line2BaselineY = 292;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#070b19';
  ctx.fillText(headline.line2, line2StartX, line2BaselineY);

  // Desenha o mini-badge com o ícone ao lado da 2ª linha
  const badgeX = line2StartX + line2Width + badgeGap;
  const badgeY = line2BaselineY - badgeSize + 4;
  drawRoundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, 12);
  ctx.fillStyle = headline.badgeBg;
  ctx.fill();

  ctx.font = `700 27px ${fontStack}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline.badgeIcon, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);

  // 4. Localização (até 2 linhas centralizadas)
  const cleanLoc = (options.locationText || 'Local registrado no Multei').trim();
  const fullLocString = `📍 ${cleanLoc}`;
  ctx.font = `600 32px ${fontStack}`;
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const locLines = wrapCanvasText(ctx, fullLocString, 920, 2);
  let locY = 358;
  for (const line of locLines) {
    ctx.fillText(line, W / 2, locY);
    locY += 44;
  }

  // 5. Quadro Central da Foto (ou Antes/Depois quando resolvido)
  const cardX = 68;
  const cardY = locLines.length > 1 ? 444 : 416;
  const cardW = W - cardX * 2; // 944
  const cardH = BODY_H - cardY - 56;
  const cardRadius = 40;

  // Sombra + Moldura branca
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const pad = 12;
  const innerX = cardX + pad;
  const innerY = cardY + pad;
  const innerW = cardW - pad * 2;
  const innerH = cardH - pad * 2;
  const innerRadius = cardRadius - 8;

  const primaryPhotoUrl = options.photoUrl || options.photoSrc || '';
  const resolvedAfterUrl = options.resolvedPhotoUrl || options.afterPhotoSrc || '';

  if (options.isResolved && resolvedAfterUrl) {
    // MODO PROBLEMA RESOLVIDO: Comparativo ANTES e DEPOIS lado a lado
    const [beforeImg, afterImg] = await Promise.all([
      loadImageForCanvas(primaryPhotoUrl),
      loadImageForCanvas(resolvedAfterUrl)
    ]);

    const colGap = 12;
    const colW = (innerW - colGap) / 2;
    const leftX = innerX;
    const rightX = innerX + colW + colGap;

    // Coluna ANTES
    drawRoundedRectPath(ctx, leftX, innerY, colW, innerH, 28);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    if (beforeImg) {
      drawImageSmartInFrame(ctx, beforeImg, leftX, innerY, colW, innerH, 28, true);
    }

    // Badge "⚠️ ANTES"
    const beforeTagText = '⚠️ ANTES';
    ctx.font = `800 25px ${fontStack}`;
    const beforeTagW = ctx.measureText(beforeTagText).width + 46;
    const beforeTagH = 52;
    const beforeTagX = leftX + (colW - beforeTagW) / 2;
    const beforeTagY = innerY + 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 12;
    drawRoundedRectPath(ctx, beforeTagX, beforeTagY, beforeTagW, beforeTagH, 26);
    const beforeGrad = ctx.createLinearGradient(beforeTagX, beforeTagY, beforeTagX, beforeTagY + beforeTagH);
    beforeGrad.addColorStop(0, 'rgba(217, 119, 6, 0.95)');
    beforeGrad.addColorStop(1, 'rgba(180, 83, 9, 0.95)');
    ctx.fillStyle = beforeGrad;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(beforeTagText, beforeTagX + beforeTagW / 2, beforeTagY + beforeTagH / 2 + 1);

    // Coluna DEPOIS
    drawRoundedRectPath(ctx, rightX, innerY, colW, innerH, 28);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    if (afterImg) {
      drawImageSmartInFrame(ctx, afterImg, rightX, innerY, colW, innerH, 28, true);
    }

    // Badge "✅ DEPOIS" (sem "(RESOLVIDO)")
    const afterTagText = '✅ DEPOIS';
    ctx.font = `800 25px ${fontStack}`;
    const afterTagW = ctx.measureText(afterTagText).width + 46;
    const afterTagH = 52;
    const afterTagX = rightX + (colW - afterTagW) / 2;
    const afterTagY = innerY + 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 12;
    drawRoundedRectPath(ctx, afterTagX, afterTagY, afterTagW, afterTagH, 26);
    const afterGrad = ctx.createLinearGradient(afterTagX, afterTagY, afterTagX, afterTagY + afterTagH);
    afterGrad.addColorStop(0, 'rgba(22, 163, 74, 0.95)');
    afterGrad.addColorStop(1, 'rgba(21, 128, 61, 0.95)');
    ctx.fillStyle = afterGrad;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(afterTagText, afterTagX + afterTagW / 2, afterTagY + afterTagH / 2 + 1);
  } else {
    // MODO PADRÃO: Foto única da denúncia
    drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    const mainImg = await loadImageForCanvas(primaryPhotoUrl);
    if (mainImg) {
      drawImageSmartInFrame(ctx, mainImg, innerX, innerY, innerW, innerH, innerRadius, false);
    }

    // Selo "Filtro privacidade aplicado" no canto inferior direito da foto
    const blurBadgeText = 'Filtro privacidade aplicado';
    ctx.font = `600 24px ${fontStack}`;
    const blurTextW = ctx.measureText(blurBadgeText).width;
    const blurW = blurTextW + 46;
    const blurH = 50;
    const blurX = innerX + innerW - blurW - 24;
    const blurY = innerY + innerH - blurH - 22;

    drawRoundedRectPath(ctx, blurX, blurY, blurW, blurH, 25);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(blurBadgeText, blurX + blurW / 2, blurY + blurH / 2 + 1);
  }

  // 6. Rodapé Call-to-Action Roxo (#86007D)
  const footerGrad = ctx.createLinearGradient(0, BODY_H, W, H);
  footerGrad.addColorStop(0, '#86007D');
  footerGrad.addColorStop(1, '#6e0066');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, BODY_H, W, FOOTER_H);

  // Quando a aplicação for liberada para todo o público, voltar para: 'Denuncie você também pelo' e 'www.valepcd.com.br/multei'
  ctx.font = `700 44px ${fontStack}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Saiba como participar em:', W / 2, BODY_H + 88);

  // Pílula branca "www.valepcd.com.br"
  const ctaUrlText = 'www.valepcd.com.br';
  ctx.font = `800 42px ${fontStack}`;
  const ctaUrlW = ctx.measureText(ctaUrlText).width;
  const ctaPillW = ctaUrlW + 88;
  const ctaPillH = 86;
  const ctaPillX = (W - ctaPillW) / 2;
  const ctaPillY = BODY_H + 120;

  drawRoundedRectPath(ctx, ctaPillX, ctaPillY, ctaPillW, ctaPillH, 43);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.fillStyle = '#86007D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaUrlText, W / 2, ctaPillY + ctaPillH / 2 + 2);

  const isPng = mimeType === 'image/png';
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Falha ao exportar card de compartilhamento.'));
      },
      isPng ? 'image/png' : 'image/jpeg',
      isPng ? undefined : 0.93
    );
  });

  const fileName = buildShareCardFilename(options, isPng);
  return new File(
    [blob],
    fileName,
    { type: isPng ? 'image/png' : 'image/jpeg' }
  );
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
}

export interface InstagramGeneralReportCardOptions {
  title: string;
  periodSubtitle?: string;
  totalGeral: number;
  cidadesCount: number;
  infracoesTransito: number;
  mobilidadeUrbana: number;
  resolvidos: number;
}

function fitSingleLineFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontWeight: number,
  fontStack: string,
  maxPx: number,
  minPx: number,
  maxWidth: number
): number {
  let size = maxPx;
  while (size > minPx) {
    ctx.font = `${fontWeight} ${size}px ${fontStack}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 2;
  }
  return minPx;
}

function drawPrivacyAppliedBadge(
  ctx: CanvasRenderingContext2D,
  fontStack: string,
  rightEdgeX: number,
  bottomEdgeY: number
): void {
  const blurBadgeText = 'Filtro privacidade aplicado';
  ctx.font = `600 22px ${fontStack}`;
  const blurTextW = ctx.measureText(blurBadgeText).width;
  const blurW = blurTextW + 40;
  const blurH = 44;
  const blurX = rightEdgeX - blurW - 18;
  const blurY = bottomEdgeY - blurH - 18;

  drawRoundedRectPath(ctx, blurX, blurY, blurW, blurH, 22);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(blurBadgeText, blurX + blurW / 2, blurY + blurH / 2 + 1);
}

function drawInstagramFeedBackgroundAndTopPill(
  ctx: CanvasRenderingContext2D,
  W: number,
  BODY_H: number,
  fontStack: string,
  pillY = 40
): void {
  const bgGrad = ctx.createLinearGradient(0, 0, W, BODY_H);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(0.52, '#f5f0ff');
  bgGrad.addColorStop(1, '#f3e3fa');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, BODY_H);

  const glowRight = ctx.createRadialGradient(
    W * 0.9,
    BODY_H * 0.5,
    30,
    W * 0.9,
    BODY_H * 0.5,
    560
  );
  glowRight.addColorStop(0, 'rgba(192, 132, 252, 0.18)');
  glowRight.addColorStop(1, 'rgba(192, 132, 252, 0)');
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, W, BODY_H);

  const pillText = 'MULTEI • VALE PCD';
  ctx.font = `700 22px ${fontStack}`;
  const pillTextW = ctx.measureText(pillText).width;
  const pillW = pillTextW + 52;
  const pillH = 46;
  const pillX = (W - pillW) / 2;

  drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 23);
  ctx.fillStyle = 'rgba(237, 233, 254, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = 'rgba(134, 0, 125, 0.18)';
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, W / 2, pillY + pillH / 2 + 1);
}

function drawInstagramFeedPurpleFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  BODY_H: number,
  FOOTER_H: number,
  fontStack: string,
  ctaLabel: string,
  ctaUrl: string
): void {
  const footerGrad = ctx.createLinearGradient(0, BODY_H, W, H);
  footerGrad.addColorStop(0, '#86007D');
  footerGrad.addColorStop(1, '#6e0066');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, BODY_H, W, FOOTER_H);

  ctx.font = `700 34px ${fontStack}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ctaLabel, W / 2, BODY_H + 64);

  ctx.font = `800 34px ${fontStack}`;
  const ctaUrlW = ctx.measureText(ctaUrl).width;
  const ctaPillW = Math.min(W - 96, ctaUrlW + 76);
  const ctaPillH = 68;
  const ctaPillX = (W - ctaPillW) / 2;
  const ctaPillY = BODY_H + 92;

  drawRoundedRectPath(ctx, ctaPillX, ctaPillY, ctaPillW, ctaPillH, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.fillStyle = '#86007D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaUrl, W / 2, ctaPillY + ctaPillH / 2 + 1);
}

/**
 * Gera um slide `1080x1350` (proporção oficial 4:5 de Feed do Instagram) para publicação na Fase 1.
 */
export async function generateInstagramCarouselSlideFile(
  options: InstagramCarouselSlideOptions
): Promise<File> {
  const W = 1080;
  const H = 1350;
  const FOOTER_H = 196;
  const BODY_H = H - FOOTER_H; // 1154

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D indisponível para renderizar o slide do Instagram.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  drawInstagramFeedBackgroundAndTopPill(ctx, W, BODY_H, fontStack, 38);

  const headline = getShareHeadlineInfo({
    isResolved: options.isResolved,
    natureza: options.natureza,
    verificacao: options.verificacao
  });

  const cleanRua = String(options.rua || '').trim();
  const cleanBairro = String(options.bairro || '').trim();
  const cleanCidade = String(options.cidade || 'Cidade').trim();
  const cleanEstado = String(options.estado || '').trim().toUpperCase();
  const cityLabel = cleanEstado ? `${cleanCidade} - ${cleanEstado}` : cleanCidade;

  const streetParts = [cleanRua, cleanBairro].filter(Boolean);
  const streetNeighborhoodLine =
    streetParts.length > 0 ? streetParts.join(' - ') : 'Local registrado no Multei';

  const isCoverSlide = options.slideIndex === 0;
  let cardY = 336;

  if (isCoverSlide) {
    if (options.isResolved) {
      // Capa celebrativa limpa (sem blur verde): pílula sólida de alto contraste #86007D
      const kickerText = '✨ A transformação acontece em:';
      ctx.font = `700 28px ${fontStack}`;
      const kickerW = Math.min(W - 100, ctx.measureText(kickerText).width + 64);
      const kickerH = 52;
      const kickerX = (W - kickerW) / 2;
      const kickerY = 102;

      drawRoundedRectPath(ctx, kickerX, kickerY, kickerW, kickerH, 26);
      ctx.fillStyle = '#86007D';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kickerText, W / 2, kickerY + kickerH / 2 + 1);

      const cityDisplay = `📍 ${cityLabel}`;
      const cityFontPx = fitSingleLineFontSize(ctx, cityDisplay, 800, fontStack, 58, 36, 940);
      ctx.font = `800 ${cityFontPx}px ${fontStack}`;
      ctx.fillStyle = '#070b19';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cityDisplay, W / 2, 224);

      ctx.font = `600 30px ${fontStack}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText('Problema de Mobilidade Resolvido', W / 2, 272);

      ctx.font = `500 27px ${fontStack}`;
      ctx.fillStyle = '#334155';
      const addrLines = wrapCanvasText(ctx, streetNeighborhoodLine, 920, 1);
      if (addrLines[0]) {
        ctx.fillText(addrLines[0], W / 2, 310);
      }

      cardY = 338;
    } else {
      // Capa padrão do dia: "Hoje em:" acima do nome da cidade, sem emoji antes de "Denúncia de..."
      ctx.font = `700 38px ${fontStack}`;
      ctx.fillStyle = '#5b4b7a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Hoje em:', W / 2, 138);

      const cityDisplay = `📍 ${cityLabel}`;
      const cityFontPx = fitSingleLineFontSize(ctx, cityDisplay, 800, fontStack, 58, 36, 940);
      ctx.font = `800 ${cityFontPx}px ${fontStack}`;
      ctx.fillStyle = '#070b19';
      ctx.fillText(cityDisplay, W / 2, 210);

      // Subtítulo limpo sem emoji antes de "Denúncia de..."
      ctx.font = `600 30px ${fontStack}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(headline.shareTitlePlain, W / 2, 260);

      ctx.font = `500 27px ${fontStack}`;
      ctx.fillStyle = '#334155';
      const addrLines = wrapCanvasText(ctx, streetNeighborhoodLine, 920, 1);
      if (addrLines[0]) {
        ctx.fillText(addrLines[0], W / 2, 298);
      }

      cardY = 328;
    }
  } else {
    // Slides internos (2 a 9)
    ctx.font = `800 54px ${fontStack}`;
    ctx.fillStyle = '#070b19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(headline.line1, W / 2, 154);

    const line2W = ctx.measureText(headline.line2).width;
    const badgeSize = 42;
    const badgeGap = 14;
    const totalLine2W = line2W + badgeGap + badgeSize;
    const line2StartX = (W - totalLine2W) / 2;
    const line2BaselineY = 220;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#070b19';
    ctx.fillText(headline.line2, line2StartX, line2BaselineY);

    const badgeX = line2StartX + line2W + badgeGap;
    const badgeY = line2BaselineY - badgeSize + 4;
    drawRoundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, 11);
    ctx.fillStyle = headline.badgeBg;
    ctx.fill();

    ctx.font = `700 25px ${fontStack}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headline.badgeIcon, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);

    const fullInternalLoc = `📍 ${streetNeighborhoodLine} • ${cityLabel}`;
    ctx.font = `600 28px ${fontStack}`;
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const locLines = wrapCanvasText(ctx, fullInternalLoc, 930, 2);
    let locY = 272;
    for (const l of locLines) {
      ctx.fillText(l, W / 2, locY);
      locY += 36;
    }

    cardY = locLines.length > 1 ? 336 : 306;
  }

  // Quadro central da foto (ou comparativo Antes / Depois)
  const cardX = 56;
  const cardW = W - cardX * 2; // 968
  const cardH = BODY_H - cardY - 32;
  const cardRadius = 36;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.13)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const pad = 12;
  const innerX = cardX + pad;
  const innerY = cardY + pad;
  const innerW = cardW - pad * 2;
  const innerH = cardH - pad * 2;
  const innerRadius = cardRadius - 8;

  if (options.isResolved && options.resolvedPhotoUrl) {
    const [beforeImg, afterImg] = await Promise.all([
      loadImageForCanvas(options.photoUrl),
      loadImageForCanvas(options.resolvedPhotoUrl)
    ]);

    const colGap = 12;
    const colW = (innerW - colGap) / 2;
    const leftX = innerX;
    const rightX = innerX + colW + colGap;

    drawRoundedRectPath(ctx, leftX, innerY, colW, innerH, 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    if (beforeImg) {
      drawImageSmartInFrame(ctx, beforeImg, leftX, innerY, colW, innerH, 24, true);
    }

    const beforeTagText = '⚠️ ANTES';
    ctx.font = `800 23px ${fontStack}`;
    const beforeTagW = ctx.measureText(beforeTagText).width + 40;
    const beforeTagH = 46;
    const beforeTagX = leftX + (colW - beforeTagW) / 2;
    const beforeTagY = innerY + 20;

    drawRoundedRectPath(ctx, beforeTagX, beforeTagY, beforeTagW, beforeTagH, 23);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(beforeTagText, beforeTagX + beforeTagW / 2, beforeTagY + beforeTagH / 2 + 1);

    drawRoundedRectPath(ctx, rightX, innerY, colW, innerH, 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    if (afterImg) {
      drawImageSmartInFrame(ctx, afterImg, rightX, innerY, colW, innerH, 24, true);
    }

    const afterTagText = '✅ DEPOIS';
    ctx.font = `800 23px ${fontStack}`;
    const afterTagW = ctx.measureText(afterTagText).width + 40;
    const afterTagH = 46;
    const afterTagX = rightX + (colW - afterTagW) / 2;
    const afterTagY = innerY + 20;

    drawRoundedRectPath(ctx, afterTagX, afterTagY, afterTagW, afterTagH, 23);
    ctx.fillStyle = 'rgba(22, 163, 74, 0.95)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(afterTagText, afterTagX + afterTagW / 2, afterTagY + afterTagH / 2 + 1);

    drawPrivacyAppliedBadge(ctx, fontStack, innerX + innerW, innerY + innerH);

    // Contador 1/N no canto inferior esquerdo para não sobrepor o selo DEPOIS
    if (isCoverSlide && options.totalSlides > 1) {
      const counterText = `1/${options.totalSlides} ➔`;
      ctx.font = `700 23px ${fontStack}`;
      const cW = ctx.measureText(counterText).width + 36;
      const cH = 44;
      const cX = leftX + 18;
      const cY = innerY + innerH - cH - 18;

      drawRoundedRectPath(ctx, cX, cY, cW, cH, 22);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(counterText, cX + cW / 2, cY + cH / 2 + 1);
    }
  } else {
    drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    const mainImg = await loadImageForCanvas(options.photoUrl);
    if (mainImg) {
      drawImageSmartInFrame(ctx, mainImg, innerX, innerY, innerW, innerH, innerRadius, false);
    }

    drawPrivacyAppliedBadge(ctx, fontStack, innerX + innerW, innerY + innerH);

    if (isCoverSlide && options.totalSlides > 1) {
      const counterText = `1/${options.totalSlides} ➔`;
      ctx.font = `700 23px ${fontStack}`;
      const cW = ctx.measureText(counterText).width + 36;
      const cH = 44;
      const cX = innerX + innerW - cW - 18;
      const cY = innerY + 18;

      drawRoundedRectPath(ctx, cX, cY, cW, cH, 22);
      ctx.fillStyle = 'rgba(88, 28, 135, 0.86)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(counterText, cX + cW / 2, cY + cH / 2 + 1);
    }
  }

  drawInstagramFeedPurpleFooter(
    ctx,
    W,
    H,
    BODY_H,
    FOOTER_H,
    fontStack,
    'Denuncie você também pelo',
    'www.valepcd.com.br/multei'
  );

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
 * Gera a arte `1080x1350` (4:5 Feed) do Relatório Geral do Multei (Fase 2),
 * incluindo o card de Problemas Resolvidos somente quando `resolvidos >= 1`.
 */
export async function generateInstagramGeneralReportFile(
  options: InstagramGeneralReportCardOptions
): Promise<File> {
  const W = 1080;
  const H = 1350;
  const FOOTER_H = 196;
  const BODY_H = H - FOOTER_H; // 1154

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto 2D indisponível para gerar o relatório geral.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  drawInstagramFeedBackgroundAndTopPill(ctx, W, BODY_H, fontStack, 44);

  const cleanTitle = String(options.title || 'Essa semana no Multei').trim();
  const titleFontPx = fitSingleLineFontSize(ctx, cleanTitle, 800, fontStack, 64, 42, 932);
  ctx.font = `800 ${titleFontPx}px ${fontStack}`;
  ctx.fillStyle = '#070b19';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cleanTitle, W / 2, 184);

  const subtitle = String(options.periodSubtitle || '').trim();
  if (subtitle) {
    ctx.font = `500 28px ${fontStack}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(subtitle, W / 2, 232);
  }

  const hasResolved = options.resolvidos >= 1;
  const marginX = 74;
  const fullCardW = W - marginX * 2; // 932
  const colGap = 28;
  const halfCardW = (fullCardW - colGap) / 2; // 452

  const startY = hasResolved ? (subtitle ? 270 : 252) : subtitle ? 320 : 298;
  const rowGap = hasResolved ? 26 : 34;
  const topCardH = hasResolved ? 210 : 244;
  const midCardH = hasResolved ? 256 : 296;
  const resCardH = 196;

  // Card 1: Total de registros mapeados em X cidades
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRectPath(ctx, marginX, startY, fullCardW, topCardH, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, marginX, startY, fullCardW, topCardH, 32);
  ctx.clip();
  ctx.fillStyle = '#8b5cf6';
  ctx.fillRect(marginX, startY, fullCardW, 8);
  ctx.restore();

  ctx.font = `800 ${hasResolved ? 86 : 96}px ${fontStack}`;
  ctx.fillStyle = '#070b19';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    String(Math.max(0, Math.floor(options.totalGeral))),
    W / 2,
    startY + (hasResolved ? 118 : 134)
  );

  const citiesWord = options.cidadesCount === 1 ? 'cidade' : 'cidades';
  ctx.font = `500 31px ${fontStack}`;
  ctx.fillStyle = '#1e293b';
  ctx.fillText(
    `Registros mapeados em ${Math.max(0, Math.floor(options.cidadesCount))} ${citiesWord}`,
    W / 2,
    startY + (hasResolved ? 172 : 194)
  );

  // Cards 2 e 3: Denúncias de Trânsito | Mobilidade Urbana (sem subtítulos)
  const midY = startY + topCardH + rowGap;

  const drawHalfMetricCard = (
    x: number,
    iconText: string,
    circleBg: string,
    value: number,
    labelLine1: string,
    labelLine2: string
  ) => {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    drawRoundedRectPath(ctx, x, midY, halfCardW, midCardH, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    drawRoundedRectPath(ctx, x, midY, halfCardW, midCardH, 32);
    ctx.stroke();

    // Ícone circular + número lado a lado no topo do card
    const numStr = String(Math.max(0, Math.floor(value)));
    ctx.font = `800 78px ${fontStack}`;
    const numW = ctx.measureText(numStr).width;
    const circleR = 36;
    const pairGap = 22;
    const pairW = circleR * 2 + pairGap + numW;
    const pairStartX = x + (halfCardW - pairW) / 2;
    const centerRowY = midY + (hasResolved ? 86 : 102);

    ctx.beginPath();
    ctx.arc(pairStartX + circleR, centerRowY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = circleBg;
    ctx.fill();

    ctx.font = `700 36px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconText, pairStartX + circleR, centerRowY + 2);

    ctx.font = `800 78px ${fontStack}`;
    ctx.fillStyle = '#070b19';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(numStr, pairStartX + circleR * 2 + pairGap, centerRowY + 4);

    ctx.font = `500 32px ${fontStack}`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(labelLine1, x + halfCardW / 2, midY + (hasResolved ? 176 : 202));
    ctx.fillText(labelLine2, x + halfCardW / 2, midY + (hasResolved ? 216 : 244));
  };

  drawHalfMetricCard(
    marginX,
    '♿',
    '#ede9fe',
    options.infracoesTransito,
    'Denúncias',
    'de Trânsito'
  );
  drawHalfMetricCard(
    marginX + halfCardW + colGap,
    '🚧',
    '#fef3c7',
    options.mobilidadeUrbana,
    'Mobilidade',
    'Urbana'
  );

  // Card 4 condicional: Problemas Resolvidos (somente quando >= 1)
  if (hasResolved) {
    const resY = midY + midCardH + rowGap;

    ctx.save();
    ctx.shadowColor = 'rgba(5, 150, 105, 0.1)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    drawRoundedRectPath(ctx, marginX, resY, fullCardW, resCardH, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, marginX, resY, fullCardW, resCardH, 32);
    ctx.clip();
    ctx.fillStyle = '#10b981';
    ctx.fillRect(marginX, resY, fullCardW, 8);
    ctx.restore();

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    drawRoundedRectPath(ctx, marginX, resY, fullCardW, resCardH, 32);
    ctx.stroke();

    // Ícone verde de check à esquerda + número grande centralizado + rótulo "Problemas Resolvidos"
    const checkOuterR = 36;
    const checkInnerR = 24;
    const checkCx = marginX + 78;
    const checkCy = resY + resCardH / 2 + 4;

    ctx.beginPath();
    ctx.arc(checkCx, checkCy, checkOuterR, 0, Math.PI * 2);
    ctx.fillStyle = '#d1fae5';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(checkCx, checkCy, checkInnerR, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    ctx.font = `800 28px ${fontStack}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', checkCx, checkCy + 1);

    ctx.font = `800 76px ${fontStack}`;
    ctx.fillStyle = '#070b19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(Math.floor(options.resolvidos)), W / 2, resY + 108);

    ctx.font = `500 32px ${fontStack}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Problemas Resolvidos', W / 2, resY + 158);
  }

  drawInstagramFeedPurpleFooter(
    ctx,
    W,
    H,
    BODY_H,
    FOOTER_H,
    fontStack,
    'Conheça o projeto e apoie em',
    'valepcd.com.br/multei/sobre'
  );

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