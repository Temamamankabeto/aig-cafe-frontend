"use client";

import { useMemo } from "react";
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from "@zxing/library";

/** Generate QR entirely in the browser: never send card secrets to third-party QR services. */
export function makeQrSvg(code: string, dimension = 240): string {
  const matrix = new QRCodeWriter().encode(code, BarcodeFormat.QR_CODE, dimension, dimension, new Map([[EncodeHintType.MARGIN, 2]]));
  const rects: string[] = [];
  for (let y = 0; y < matrix.getHeight(); y++) {
    for (let x = 0; x < matrix.getWidth(); x++) {
      if (matrix.get(x, y)) rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.getWidth()} ${matrix.getHeight()}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects.join("")}</g></svg>`;
}

export function LocalWaiterQr({ code, size = 200 }: { code: string; size?: number }) {
  const svg = useMemo(() => makeQrSvg(code), [code]);
  return <div role="img" aria-label="Private waiter QR identification card" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
