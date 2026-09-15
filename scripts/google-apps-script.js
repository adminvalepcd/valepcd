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
        var photoCol = headers.indexOf('foto');
        if (photoCol === -1) photoCol = headers.indexOf('image');
        obj.foto = '';
        obj.tem_foto = (photoCol >= 0 && Boolean(row[photoCol]));
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

    // 1. Garantir que os cabeçalhos existam na ordem padrão: id | data | latitude | longitude | foto | ativo | motivo_denuncia | cidade | estado
    var headers = [];
    if (sheet.getLastRow() === 0) {
      headers = ['id', 'data', 'latitude', 'longitude', 'foto', 'ativo', 'motivo_denuncia', 'cidade', 'estado'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    } else {
      var lastCol = sheet.getLastColumn();
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
        return String(h).trim().toLowerCase();
      });

      // Se a planilha já tinha colunas antigas, adiciona as novas colunas que faltarem dinamicamente (cidade e estado no final após motivo_denuncia)
      var requiredHeaders = ['foto', 'ativo', 'motivo_denuncia', 'cidade', 'estado'];
      for (var r = 0; r < requiredHeaders.length; r++) {
        var req = requiredHeaders[r];
        if (headers.indexOf(req) === -1) {
          lastCol++;
          sheet.getRange(1, lastCol).setValue(req).setFontWeight('bold');
          headers.push(req);
        }
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

      // Procura a linha com o id correspondente (coluna 'id')
      const idCol = headers.indexOf('id');
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol >= 0 ? idCol : 0]).trim() === incidentId) {
          foundRowIndex = i + 1; // 1-based index no Sheets
          break;
        }
      }

      if (foundRowIndex > 0) {
        const colAtivo = headers.indexOf('ativo') + 1;
        const colMotivo = headers.indexOf('motivo_denuncia') + 1;
        if (colAtivo > 0) sheet.getRange(foundRowIndex, colAtivo).setValue(false);
        if (colMotivo > 0) sheet.getRange(foundRowIndex, colMotivo).setValue(reason);
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
    var cidade = String(payload.cidade || '').trim();
    var estado = String(payload.estado || '').trim();
    const foto = payload.foto || '';
    const ativo = payload.ativo !== undefined ? Boolean(payload.ativo) : true;
    const motivo = payload.motivo_denuncia || '';

    // Se cidade ou estado vierem vazios, tenta resolver com busca multi-nível e fallbacks
    if ((!cidade || !estado) && latitude && longitude) {
      var resolved = resolveLocationCityAndState(latitude, longitude);
      if (!cidade && resolved.cidade) cidade = resolved.cidade;
      if (!estado && resolved.estado) estado = resolved.estado;
    }

    if (estado) {
      estado = normalizeStateUF(estado);
    }

    // Monta a linha conforme a ordem exata das colunas no cabeçalho
    var newRow = [];
    for (var h = 0; h < headers.length; h++) {
      var col = headers[h];
      if (col === 'id') newRow.push(id);
      else if (col === 'data' || col === 'timestamp') newRow.push(dataIso);
      else if (col === 'latitude') newRow.push(latitude);
      else if (col === 'longitude') newRow.push(longitude);
      else if (col === 'foto' || col === 'image') newRow.push(foto);
      else if (col === 'ativo') newRow.push(ativo);
      else if (col === 'motivo_denuncia') newRow.push(motivo);
      else if (col === 'cidade') newRow.push(cidade);
      else if (col === 'estado') newRow.push(estado);
      else newRow.push(payload[col] || '');
    }

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();

    return jsonResponse({
      status: 'ok',
      success: true,
      id: id,
      cidade: cidade,
      estado: estado,
      ativo: ativo
    });
  } catch (error) {
    return jsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * Normaliza o estado para sigla UF padrão (2 letras maiúsculas)
 */
function normalizeStateUF(stateStr) {
  if (!stateStr) return '';
  var s = String(stateStr).trim();
  if (s.length === 2) return s.toUpperCase();

  var map = {
    'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP',
    'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE',
    'distrito federal': 'DF', 'espírito santo': 'ES', 'espirito santo': 'ES',
    'goiás': 'GO', 'goias': 'GO', 'maranhão': 'MA', 'maranhao': 'MA',
    'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
    'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
    'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI',
    'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
    'rio grande do sul': 'RS', 'rondônia': 'RO', 'rondonia': 'RO',
    'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP',
    'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
  };

  var lower = s.toLowerCase();
  return map[lower] || s;
}

/**
 * Resolve cidade e estado a partir de coordenadas geográficas
 * 1. Varre TODOS os resultados do Maps.newGeocoder() do Google Apps Script
 * 2. Fallback resiliente via OpenStreetMap Nominatim usando UrlFetchApp
 * 3. Fallback BigDataCloud extraindo o município (adminLevel === 8)
 */
function resolveLocationCityAndState(lat, lng) {
  var result = { cidade: '', estado: '' };
  if (!lat || !lng) return result;

  // 1. Google Maps Geocoder Nativo do Google Apps Script
  try {
    var geo = Maps.newGeocoder().setLanguage('pt-BR').reverseGeocode(lat, lng);
    if (geo && geo.status === 'OK' && geo.results && geo.results.length > 0) {
      // Varre TODOS os resultados (rua, bairro, localidade, município)
      for (var r = 0; r < geo.results.length; r++) {
        var comps = geo.results[r].address_components || [];
        for (var c = 0; c < comps.length; c++) {
          var types = comps[c].types || [];
          if (!result.estado && types.indexOf('administrative_area_level_1') !== -1) {
            result.estado = comps[c].short_name || comps[c].long_name || '';
          }
          if (!result.cidade && types.indexOf('administrative_area_level_2') !== -1) {
            var candidate = comps[c].long_name || comps[c].short_name || '';
            if (candidate && candidate.toLowerCase().indexOf('região metropolitana') === -1) {
              result.cidade = candidate;
            }
          }
          if (!result.cidade && types.indexOf('locality') !== -1) {
            var candidateLoc = comps[c].long_name || comps[c].short_name || '';
            if (candidateLoc && candidateLoc.toLowerCase().indexOf('região metropolitana') === -1) {
              result.cidade = candidateLoc;
            }
          }
        }
        if (result.cidade && result.estado) break;
      }
    }
  } catch (geoErr) {
    // Maps nativo indisponível ou cota atingida
  }

  // 2. Fallback OpenStreetMap Nominatim via UrlFetchApp caso ainda falte cidade ou estado
  if (!result.cidade || !result.estado) {
    try {
      var osmUrl = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&zoom=18&addressdetails=1&email=contato@valepcd.com.br';
      var response = UrlFetchApp.fetch(osmUrl, {
        headers: {
          'User-Agent': 'ValePCD-AppsScript/1.0 (contato@valepcd.com.br)',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        },
        muteHttpExceptions: true
      });
      if (response.getResponseCode() === 200) {
        var osmData = JSON.parse(response.getContentText());
        if (osmData && osmData.address) {
          var addr = osmData.address;
          if (!result.cidade) {
            result.cidade = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.county || addr.hamlet || '';
          }
          if (!result.estado) {
            if (addr['ISO3166-2-lvl4']) {
              result.estado = String(addr['ISO3166-2-lvl4']).replace(/^BR-/, '');
            } else {
              result.estado = addr.state || '';
            }
          }
        }
      }
    } catch (osmErr) {
      // Fallback silencioso
    }
  }

  // 3. Fallback BigDataCloud extraindo adminLevel 8 (Município brasileiro)
  if (!result.cidade || !result.estado) {
    try {
      var bdcUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lng) + '&localityLanguage=pt';
      var bdcRes = UrlFetchApp.fetch(bdcUrl, { muteHttpExceptions: true });
      if (bdcRes.getResponseCode() === 200) {
        var bdcData = JSON.parse(bdcRes.getContentText());
        var adminList = (bdcData && bdcData.localityInfo && bdcData.localityInfo.administrative) ? bdcData.localityInfo.administrative : [];
        if (!result.cidade) {
          for (var a = 0; a < adminList.length; a++) {
            if (adminList[a].adminLevel === 8 && adminList[a].name) {
              result.cidade = String(adminList[a].name).trim();
              break;
            }
          }
          if (!result.cidade) {
            var cand = bdcData.locality || bdcData.city || '';
            if (cand && cand.toLowerCase().indexOf('região metropolitana') === -1) {
              result.cidade = String(cand).trim();
            }
          }
        }
        if (!result.estado) {
          var code = bdcData.principalSubdivisionCode ? String(bdcData.principalSubdivisionCode).replace(/^BR-/, '') : '';
          result.estado = code || bdcData.principalSubdivision || '';
        }
      }
    } catch (bdcErr) {
      // Fallback silencioso
    }
  }

  result.estado = normalizeStateUF(result.estado);
  if (result.estado === 'DF' && (!result.cidade || result.cidade.toLowerCase().indexOf('plano piloto') !== -1)) {
    result.cidade = 'Brasília';
  }

  return result;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
