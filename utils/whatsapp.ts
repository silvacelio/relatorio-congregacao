/**
 * Utilitário centralizado para normalização de telefones brasileiros/internacionais
 * e geração de links WhatsApp (wa.me) para lembretes e integrações futuras.
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

  // Remove prefixo internacional 00 se informado
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Números brasileiros locais (DDD + 8 ou 9 dígitos = 10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return digits;
}

/**
 * Valida se o telefone possui dígitos suficientes para abrir conversa no WhatsApp.
 * Após normalização: Brasil tem 12 ou 13 dígitos (55 + DDD + número).
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
 * Estrutura preparada para integração futura do botão "🔗 Enviar Relatório"
 * (envio do link para o próprio publicador informar seu relatório pelo celular).
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
    'Muito obrigado.',
    '',
    'Secretaria da Congregação José dos Reis.',
  ].join('\n');

  return buildWhatsAppUrl(phone, message);
}
