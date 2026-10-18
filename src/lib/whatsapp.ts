import { business } from "./config";

// Single source: business.whatsappNumber in config.ts (international format,
// no "+"). It is null until the business confirms a number; every WhatsApp
// link and label is then hidden instead of pointing anywhere.
export const WHATSAPP_INTL_NUMBER: string | null = business.whatsappNumber;
export const WHATSAPP_RAW_NUMBER: string | null = WHATSAPP_INTL_NUMBER ? `0${WHATSAPP_INTL_NUMBER.slice(2)}` : null;
export const WHATSAPP_DISPLAY_NUMBER: string | null = WHATSAPP_RAW_NUMBER ? WHATSAPP_RAW_NUMBER.replace(/(\d{4})(\d+)/, "$1 $2") : null;

export const DEFAULT_WHATSAPP_MESSAGE =
  "Assalam o Alaikum, I am interested in Sabor con Amor and would like to ask about booking availability.";

/**
 * Builds a properly URL-encoded wa.me link with the configured WhatsApp number
 * and a pre-filled inquiry message, or null when no number is configured.
 */
export function getWhatsAppUrl(customMessage: string = DEFAULT_WHATSAPP_MESSAGE): string | null {
  if (!WHATSAPP_INTL_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_INTL_NUMBER}?text=${encodeURIComponent(customMessage)}`;
}
