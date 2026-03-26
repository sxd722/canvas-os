interface OCRResult {
  success: boolean;
  text?: string;
  error?: string;
}

const OCR_API_URL = 'https://api.ocr.space/parse/image';

export async function extractTextFromImage(
  base64Image: string, 
  language: string = 'eng',
  apiKey: string = 'helloworld'
): Promise<OCRResult> {
  const formData = new FormData();
  formData.append('base64Image', base64Image);
  formData.append('language', language);
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');
  formData.append('apikey', apiKey);

  try {
    const response = await fetch(OCR_API_URL, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.OCRExitCode === 1 && data.ParsedResults?.[0]?.ParsedText) {
      return {
        success: true,
        text: data.ParsedResults[0].ParsedText
      };
    } else {
      return {
        success: false,
        error: data.ErrorMessage || data.ParsedResults?.[0]?.ErrorMessage || 'OCR failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR request failed'
    };
  }
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
