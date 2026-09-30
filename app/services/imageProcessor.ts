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