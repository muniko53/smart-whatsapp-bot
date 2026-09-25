// Standalone product identity — single place to set public contact details.
// SUPPORT_WHATSAPP: support number shown by the site bot and banners, e.g. "+254700000000".
// Leave empty to omit contact lines rather than show a wrong one.
export const PRODUCT_NAME = 'Smart WhatsApp Assistant';
export const SUPPORT_WHATSAPP = '';

export function supportLine(prefix = 'Message us on WhatsApp') {
  return SUPPORT_WHATSAPP ? `${prefix}: ${SUPPORT_WHATSAPP}` : '';
}
