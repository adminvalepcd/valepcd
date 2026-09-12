/**
 * GOOGLE APPS SCRIPT - VALE PCD (Multei)
 * Planilha: https://docs.google.com/spreadsheets/d/1884lKe9k5ANy-CGigLrWZR-5iDS9Tp_dnosT-ix4wiI/edit
 * Colunas: id | data | latitude | longitude | foto | ativo | motivo_denuncia
 *
 * COMO ATUALIZAR SUA IMPLANTAÇÃO NO APPS SCRIPT:
 * 1. Na planilha, clique em: Extensões > Apps Script
 * 2. Substitua todo o conteúdo de Código.gs por este script
 * 3. Salve (💾)
 * 4. Clique em "Implantar" (Deploy) > "Gerenciar implantações" (Manage deployments)
 * 5. Clique no ícone de lápis (Editar) na implantação ativa
 * 6. Em "Versão", selecione "Nova versão" (New version)
 * 7. Clique em "Implantar" (Deploy)
 */

/**
 * Calcula a distância em quilômetros entre duas coordenadas geográficas (Fórmula de Haversine)
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Raio da Terra em km
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // Se a planilha estiver vazia ou tiver apenas cabeçalho
    if (data.length <= 1) {
      return jsonResponse([]);
    }

    var headers = data[0].map(function(h) {
      return String(h).trim().toLowerCase();
    });

    // Parâmetros de consulta
    var filterId = params.id ? String(params.id).trim() : null;
    var userLat = params.lat ? parseFloat(params.lat) : null;
    var userLng = params.lng ? parseFloat(params.lng) : null;
    var radiusKm = params.radius ? parseFloat(params.radius) : null;
    var includePhoto = params.include_photo !== undefined 
      ? (String(params.include_photo).toLowerCase() === 'true') 
      : true;

    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Pular linhas vazias
      if (!row[0] && !row[1] && !row[2]) continue;

      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        obj[headers[j]] = val;
      }

      // Se foi solicitado um ID específico (ex: clique no pino para baixar a foto pesada)
      if (filterId) {
        if (String(obj.id).trim() === filterId) {
          return jsonResponse(obj);
        }
        continue;
      }

      // Se a coluna "ativo" for false, não exibe no mapa
      var isAtivo = true;
      if (obj.ativo !== undefined && obj.ativo !== '') {
        isAtivo = (obj.ativo === true || String(obj.ativo).toLowerCase() === 'true');
      }
      if (!isAtivo) continue;

      // Filtragem por raio geográfico ao redor do GPS do usuário
      var rowLat = parseFloat(obj.latitude);
      var rowLng = parseFloat(obj.longitude);

      if (userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng) &&
          !isNaN(rowLat) && !isNaN(rowLng) && radiusKm !== null && !isNaN(radiusKm)) {
        var dist = getDistanceKm(userLat, userLng, rowLat, rowLng);
        if (dist > radiusKm) {
          continue; // Pula ocorrência fora do raio solicitado
        }
        obj.distancia_km = Math.round(dist * 10) / 10;
      }

      // Otimização de dados (Lazy Loading): omite foto em base64 se solicitado para carregamento ultra-rápido
      if (!includePhoto) {
        obj.foto = '';
        obj.tem_foto = Boolean(row[4]);
      }

      rows.push(obj);
    }

    if (filterId) {
      return jsonResponse({ status: 'not_found', message: 'Ocorrência não encontrada' });
    }

    return jsonResponse(rows);
  } catch (error) {
    return jsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 1. Garantir que os cabeçalhos existam
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['id', 'data', 'latitude', 'longitude', 'foto', 'ativo', 'motivo_denuncia']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    } else {
      // Se a planilha já tinha colunas antigas, adiciona colunas 6 e 7 se faltarem
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, Math.max(lastCol, 7)).getValues()[0];
      if (!headers[5] || headers[5] === '') {
        sheet.getRange(1, 6).setValue('ativo').setFontWeight('bold');
      }
      if (!headers[6] || headers[6] === '') {
        sheet.getRange(1, 7).setValue('motivo_denuncia').setFontWeight('bold');
      }
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        status: 'error',
        message: 'Nenhum dado enviado no corpo da requisição.'
      });
    }

    const payload = JSON.parse(e.postData.contents);

    // 2. Ação de Reportar / Denunciar Ocorrência
    if (payload.action === 'report' || payload.reason) {
      const incidentId = String(payload.id || '').trim();
      const reason = String(payload.reason || '').trim();

      const data = sheet.getDataRange().getValues();
      let foundRowIndex = -1;

      // Procura a linha com o id correspondente (coluna 1)
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === incidentId) {
          foundRowIndex = i + 1; // 1-based index no Sheets
          break;
        }
      }

      if (foundRowIndex > 0) {
        // Coluna 6 = ativo (false)
        sheet.getRange(foundRowIndex, 6).setValue(false);
        // Coluna 7 = motivo_denuncia (texto)
        sheet.getRange(foundRowIndex, 7).setValue(reason);
        SpreadsheetApp.flush();

        return jsonResponse({
          status: 'ok',
          success: true,
          action: 'report',
          id: incidentId,
          ativo: false
        });
      } else {
        return jsonResponse({
          status: 'error',
          message: 'Ocorrência ' + incidentId + ' não encontrada na planilha.'
        });
      }
    }

    // 3. Ação Padrão: Gravar Nova Ocorrência
    const id = payload.id || ('inc-' + new Date().getTime());
    const dataIso = payload.data || new Date().toISOString();
    const latitude = Number(payload.latitude) || 0;
    const longitude = Number(payload.longitude) || 0;
    const foto = payload.foto || '';
    const ativo = payload.ativo !== undefined ? Boolean(payload.ativo) : true;
    const motivo = payload.motivo_denuncia || '';

    sheet.appendRow([id, dataIso, latitude, longitude, foto, ativo, motivo]);
    SpreadsheetApp.flush();

    return jsonResponse({
      status: 'ok',
      success: true,
      id: id,
      ativo: ativo
    });
  } catch (error) {
    return jsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
