import type { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

let qrReader: BrowserQRCodeReader | null = null;

export async function decodeQrFile(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    return decodeQrDataUrl(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function decodeQrDataUrl(imageUrl: string): Promise<string> {
  const qrReader = await getQrReader();
  const result = await qrReader.decodeFromImageUrl(imageUrl);
  return result.getText();
}

export async function decodeQrFiles(files: FileList | File[]): Promise<string[]> {
  const decoded: string[] = [];
  const errors: string[] = [];

  for (const file of Array.from(files)) {
    try {
      decoded.push(await decodeQrFile(file));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'QR image could not be decoded.');
    }
  }

  if (decoded.length === 0 && errors.length > 0) {
    throw new Error('No QR codes could be decoded from the selected image files.');
  }

  return decoded;
}

export async function renderQrDataUrl(text: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
    color: {
      dark: '#111827',
      light: '#ffffff'
    }
  });
}

export async function startCameraQrScan(
  video: HTMLVideoElement,
  onText: (text: string) => void,
  onError: (message: string) => void
): Promise<IScannerControls> {
  const qrReader = await getQrReader();
  return qrReader.decodeFromConstraints(
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    video,
    (result, error, controls) => {
      if (result) {
        onText(result.getText());
        controls.stop();
      } else if (error && error.name !== 'NotFoundException') {
        onError(error.message);
      }
    }
  );
}

async function getQrReader(): Promise<BrowserQRCodeReader> {
  if (!qrReader) {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    qrReader = new BrowserQRCodeReader();
  }
  return qrReader;
}
