/**
 * Utilitário puro (sem Vue) para gerar CSV compatível com o Excel em pt-BR.
 * - BOM UTF-8 para acentuação correta;
 * - separador `;` e quebra de linha CRLF;
 * - todos os campos entre aspas, com aspas internas duplicadas;
 * - proteção contra injeção de fórmula (CSV/Formula Injection): valores de texto que começam com
 *   `=`, `+`, `-`, `@`, tab ou CR recebem o prefixo `'`.
 */

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_LINE_BREAK = '\r\n';

export interface CsvColumn<T> {
  /** Título da coluna (primeira linha). */
  header: string;
  /** Campo lido do objeto quando `value` não é informado. */
  key?: keyof T | string;
  /** Função que extrai/formata o valor da célula. Tem prioridade sobre `key`. */
  value?: (row: T, index: number) => unknown;
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const FORMULA_TRIGGER_AFTER_SPACES = /^\s+[=+\-@]/;

/** Prefixa `'` em textos que o Excel/LibreOffice interpretariam como fórmula. */
export function neutralizeCsvFormula(text: string): string {
  if (!text) return text;
  if (FORMULA_TRIGGER.test(text) || FORMULA_TRIGGER_AFTER_SPACES.test(text)) {
    return `'${text}`;
  }
  return text;
}

function formatCellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    // Número genuíno: vírgula decimal (Excel pt-BR) e sem proteção de fórmula (ex.: -19,92 é válido)
    return String(raw).replace('.', ',');
  }
  if (typeof raw === 'boolean') return raw ? 'Sim' : 'Não';
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? '' : raw.toISOString();
  }
  let text: string;
  if (Array.isArray(raw)) {
    text = raw.map((v) => (v === null || v === undefined ? '' : String(v))).join(', ');
  } else if (typeof raw === 'object') {
    try {
      text = JSON.stringify(raw);
    } catch {
      text = '';
    }
  } else {
    text = String(raw);
  }
  return neutralizeCsvFormula(text);
}

function quoteCell(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function readColumnValue<T>(row: T, column: CsvColumn<T>, index: number): unknown {
  if (typeof column.value === 'function') return column.value(row, index);
  if (column.key !== undefined && row !== null && typeof row === 'object') {
    return (row as Record<string, unknown>)[String(column.key)];
  }
  return '';
}

/** Monta o conteúdo CSV (com BOM) a partir das linhas e colunas informadas. */
export function buildCsv<T>(rows: ReadonlyArray<T>, columns: ReadonlyArray<CsvColumn<T>>): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => quoteCell(neutralizeCsvFormula(String(c.header ?? '')))).join(CSV_SEPARATOR));
  (rows || []).forEach((row, index) => {
    lines.push(
      columns.map((c) => quoteCell(formatCellValue(readColumnValue(row, c, index)))).join(CSV_SEPARATOR)
    );
  });
  return CSV_BOM + lines.join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}

/** Normaliza o nome do arquivo (sem caminhos nem caracteres reservados) e garante a extensão `.csv`. */
export function sanitizeCsvFilename(filename: string): string {
  const base = String(filename || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  const safe = base || 'exportacao';
  return /\.csv$/i.test(safe) ? safe : `${safe}.csv`;
}

/** Baixa o CSV no navegador via Blob + link temporário (sem innerHTML). */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeCsvFilename(filename);
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
