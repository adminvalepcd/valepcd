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

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // Se a planilha estiver vazia ou tiver apenas cabeçalho
    if (data.length <= 1) {
      return jsonResponse([]);
    }

    const headers = data[0].map(function(h) {
      return String(h).trim().toLowerCase();
    });

    const rows = [];
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

      // Se a coluna "ativo" estiver preenchida e for false, não envia para o mapa
      // Se não estiver preenchida (linhas anteriores), assume true por padrão
      var isAtivo = true;
      if (obj.ativo !== undefined && obj.ativo !== '') {
        isAtivo = (obj.ativo === true || String(obj.ativo).toLowerCase() === 'true');
      }

      if (isAtivo) {
        rows.push(obj);
      }
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
