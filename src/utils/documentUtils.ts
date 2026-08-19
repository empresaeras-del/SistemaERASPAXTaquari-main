/**
 * Utilitários para manipulação, visualização e download de documentos anexados
 */

export function isPdfDocument(doc: { nome: string; url?: string; tipo?: string }): boolean {
  if (doc.tipo?.toLowerCase().includes('pdf')) return true;
  if (doc.nome?.toLowerCase().endsWith('.pdf')) return true;
  if (doc.url?.startsWith('data:application/pdf')) return true;
  return false;
}

export function isImageDocument(doc: { nome: string; url?: string; tipo?: string }): boolean {
  if (doc.tipo?.toLowerCase().startsWith('image/')) return true;
  const lowerName = doc.nome?.toLowerCase() || '';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.webp') || lowerName.endsWith('.gif')) {
    return true;
  }
  if (doc.url?.startsWith('data:image/')) return true;
  return false;
}

export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Retorna uma URL segura para uso em <iframe>, <img> ou window.open
 */
export function getSafeDocumentUrl(url: string, tipo?: string): string {
  if (!url) return '';

  // Se for Base64 Data URL, converte para Blob URL ativo
  if (url.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(url);
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Erro ao converter data URL para blob:', e);
      return url;
    }
  }

  return url;
}

/**
 * Realiza o download seguro do documento
 */
export async function downloadDocumento(doc: { nome: string; url: string; tipo?: string }): Promise<boolean> {
  try {
    if (!doc.url) return false;

    // Se for Base64
    if (doc.url.startsWith('data:')) {
      const blob = dataURLtoBlob(doc.url);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.nome || 'documento';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return true;
    }

    // Se for Blob URL temporário (pode ter expirado)
    if (doc.url.startsWith('blob:')) {
      try {
        const resp = await fetch(doc.url);
        if (!resp.ok) throw new Error('Blob indisponível');
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = doc.nome || 'documento';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        return true;
      } catch (err) {
        console.warn('Blob temporário inacessível:', err);
        return false;
      }
    }

    // Se for HTTP / HTTPS (Supabase storage etc.)
    try {
      const response = await fetch(doc.url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = doc.nome || 'documento';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        return true;
      }
    } catch (e) {
      // Fallback para abertura direta
    }

    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.nome || 'documento';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Erro no download do documento:', error);
    return false;
  }
}

/**
 * Abre o documento em uma nova aba de forma segura
 */
export async function openDocumentoInNewTab(doc: { nome: string; url: string; tipo?: string }): Promise<boolean> {
  if (!doc.url) return false;

  // Se for Base64, cria um Blob URL temporário e abre
  if (doc.url.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(doc.url);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return true;
    } catch (e) {
      console.error('Erro ao abrir Base64 em nova aba:', e);
      return false;
    }
  }

  // Se for Blob URL legado
  if (doc.url.startsWith('blob:')) {
    try {
      const resp = await fetch(doc.url);
      if (!resp.ok) throw new Error('Blob expirado');
      const blob = await resp.blob();
      const freshUrl = URL.createObjectURL(blob);
      window.open(freshUrl, '_blank');
      return true;
    } catch (err) {
      return false;
    }
  }

  // Se for HTTP/HTTPS
  window.open(doc.url, '_blank', 'noopener,noreferrer');
  return true;
}
