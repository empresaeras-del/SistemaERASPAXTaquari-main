import { useEffect } from 'react';

export function usePrintPreview(isPreview: boolean) {
  useEffect(() => {
    if (isPreview) {
      document.body.classList.add('print-preview-mode');
    } else {
      document.body.classList.remove('print-preview-mode');
    }
    return () => {
      document.body.classList.remove('print-preview-mode');
    };
  }, [isPreview]);
}
