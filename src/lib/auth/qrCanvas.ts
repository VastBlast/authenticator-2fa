import { decodeQrImageData } from './qrDecode';

type QrCanvas = (HTMLCanvasElement | OffscreenCanvas) & CanvasImageSource;
type QrCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function decodeQrFromCanvas(canvas: QrCanvas): Promise<string> {
  const context = getCanvasContext(canvas);
  return decodeQrImageData(context.getImageData(0, 0, canvas.width, canvas.height));
}

function getCanvasContext(canvas: QrCanvas): QrCanvasContext {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}
