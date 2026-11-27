/**
 * Utilitário centralizado para normalização de telefones brasileiros/internacionais
 * e geração de links WhatsApp (wa.me) para lembretes e envio de relatórios.
 */

export const CONGREGATION_REMINDER_MESSAGE = [
  'Olá, irmão(a).',
  '',
  'Seu relatório ministerial deste mês ainda não foi localizado no sistema.',
  '',
  'Caso já tenha enviado, desconsidere esta mensagem.',
  '',
  'Por favor, envie seu relatório assim que possível.',
  '',
  'Muito obrigado.',
  '',
  'Secretaria da Congregação José dos Reis.',
].join('\n');

/**
 * Remove caracteres não numéricos e adiciona DDI 55 para números brasileiros
 * com 10 ou 11 dígitos sem DDI.
 */
export function normalizePhoneDigits(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return digits;
}

/**
 * Valida se o telefone possui dígitos suficientes para abrir conversa no WhatsApp.
 */
export function isValidWhatsAppPhone(rawPhone?: string | null): boolean {
  const digits = normalizePhoneDigits(rawPhone);
  return digits.length >= 12 && digits.length <= 15;
}

/**
 * Monta URL oficial wa.me com mensagem codificada via encodeURIComponent.
 */
export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 12 || digits.length > 15) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Monta o link de lembrete mensal padrão da Congregação José dos Reis.
 */
export function buildReminderWhatsAppUrl(
  phone: string,
  customMessage: string = CONGREGATION_REMINDER_MESSAGE,
): string | null {
  return buildWhatsAppUrl(phone, customMessage);
}

/**
 * Monta o link direto da página pública de envio de relatório.
 */
export function buildPublisherSelfReportUrl(
  publisherId?: string,
  monthKey?: string,
): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://relatorio-congregacao-5mld.vercel.app';

  const params = new URLSearchParams();
  if (publisherId) params.set('publicador', publisherId);
  if (monthKey) params.set('mes', monthKey);
  params.set('modo', 'publico');

  const qs = params.toString();
  return `${origin}/enviar-relatorio${qs ? `?${qs}` : ''}`;
}

/**
 * Monta o link do WhatsApp já com a mensagem e o link personalizado
 * para o próprio publicador preencher seu relatório pelo celular.
 */
export function buildSelfReportWhatsAppUrl(
  phone: string,
  publisherName: string,
  reportUrl: string,
): string | null {
  const message = [
    `Olá, ${publisherName}.`,
    '',
    'Segue o link para enviar seu relatório ministerial deste mês pelo celular:',
    reportUrl,
    '',
    'Basta abrir, preencher e tocar em "Enviar Relatório".',
    '',
    'Muito obrigado.',
    '',
    'Secretaria da Congregação José dos Reis.',
  ].join('\n');

  return buildWhatsAppUrl(phone, message);
}
