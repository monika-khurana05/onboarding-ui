import { toPng, toSvg } from 'html-to-image';

type ExportOptions = {
  fileName?: string;
  backgroundColor?: string;
};

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

export async function exportDiagramSvg(element: HTMLElement, options: ExportOptions = {}) {
  const fileName = options.fileName ?? 'fsm-diagram.svg';
  const dataUrl = await toSvg(element, {
    cacheBust: true,
    backgroundColor: options.backgroundColor
  });
  downloadDataUrl(dataUrl, fileName.endsWith('.svg') ? fileName : `${fileName}.svg`);
}

export async function exportDiagramPng(element: HTMLElement, options: ExportOptions = {}) {
  const fileName = options.fileName ?? 'fsm-diagram.png';
  const dataUrl = await toPng(element, {
    cacheBust: true,
    backgroundColor: options.backgroundColor
  });
  downloadDataUrl(dataUrl, fileName.endsWith('.png') ? fileName : `${fileName}.png`);
}
