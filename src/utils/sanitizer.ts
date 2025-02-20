
export const sanitizeString = (str: string): string => {
  // Remove HTML tags and special characters
  return str
    .replace(/[&<>"']/g, (match) => {
      const escape: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match];
    })
    .replace(/javascript:/gi, '') // Remove potential javascript: protocol
    .trim();
};

export const sanitizeFilename = (filename: string): string => {
  // Remove potentially dangerous characters from filenames
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // Replace unsafe characters with dash
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i, '_$1') // Handle reserved filenames
    .slice(0, 255); // Limit filename length
};
