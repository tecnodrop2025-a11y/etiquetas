
/**
 * Detects if the separator is a comma or semicolon based on frequency
 */
export const detectSeparator = (text: string): string => {
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  return semicolonCount >= commaCount ? ';' : ',';
};

/**
 * Converts Excel-style column letters to 0-based index
 * A=0, B=1... Z=25, AA=26, AB=27...
 */
export const letterToIndex = (col: string): number => {
  let index = 0;
  const upperCol = col.toUpperCase();
  for (let i = 0; i < upperCol.length; i++) {
    index = index * 26 + (upperCol.charCodeAt(i) - 64);
  }
  return index - 1;
};

/**
 * Normalizes comuna names (e.g. NUNOA -> ÑUÑOA)
 */
export const fixComuna = (comuna: string = ''): string => {
  if (!comuna) return '';
  let fixed = comuna.toUpperCase().trim();
  // Standard normalization for common logistics issues in Chile
  fixed = fixed.replace('NUNOA', 'ÑUÑOA');
  fixed = fixed.replace('ESTACION CENTRAL', 'ESTACIÓN CENTRAL');
  fixed = fixed.replace('PEALOLEN', 'PEÑALOLÉN');
  fixed = fixed.replace('PENALOLEN', 'PEÑALOLÉN');
  fixed = fixed.replace('SAN JOAQUIN', 'SAN JOAQUÍN');
  fixed = fixed.replace('MAIPU', 'MAIPÚ');
  return fixed;
};

/**
 * Converts a string date to DD/MM/YYYY text
 */
export const toDMY = (dateStr: string): string => {
  if (!dateStr) return '';
  // Basic handling for various formats like YYYY-MM-DD or DD-MM-YYYY
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // If Date parse fails, return original or try to sanitize
    return dateStr.substring(0, 10);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Extracts only digits from a money string, no symbols
 * (Rule 9: "22980" text)
 */
export const moneyDigitsText = (k: string): string => {
  if (!k) return '0';
  // Remove symbols and separators
  return k.replace(/[^0-9]/g, '');
};

/**
 * Converts value to integer for Enhoy format.
 * Rules: $22.980 -> 22980, 22,98 -> 22980
 */
export const moneyIntEnhoy = (k: string): number => {
  if (!k) return 0;
  const raw = k.trim().replace('$', '');
  
  // Case special: 22,98 (implies thousands as decimals in some locales)
  if (raw.includes(',') && raw.split(',')[1].length === 2) {
    const floatVal = parseFloat(raw.replace('.', '').replace(',', '.'));
    return Math.round(floatVal * 1000);
  }

  // Standard cleanup: 22.980 -> 22980
  const clean = raw.replace(/\D/g, '');
  return parseInt(clean, 10) || 0;
};

/**
 * Generate timestamp string for filenames
 */
export const getTimestamp = (): string => {
  const now = new Date();
  return now.toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/-/g, '')
    .replace(/:/g, '');
};
