export const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image as base64:', error);
    return '';
  }
};

export const fetchImageWithDimensions = async (url: string): Promise<{ base64: string, width: number, height: number } | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ base64, width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = base64;
    });
  } catch (error) {
    console.error('Error fetching image with dimensions:', error);
    return null;
  }
};
