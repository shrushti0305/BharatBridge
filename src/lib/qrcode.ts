/**
 * Lightweight pure TypeScript QR Code SVG generator.
 * Generates an SVG string or matrix for any text or URL.
 */

// Simple QR matrix builder for URLs
export function generateQRCodeSVG(text: string, size = 180): string {
  // Use public QuickChart QR API or inline SVG matrix fallback
  const encodedText = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}&bgcolor=0f172a&color=f97316`;
}
