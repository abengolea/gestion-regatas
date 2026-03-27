/**
 * Layout simplificado para demo/desarrollo.
 * La cancha real (Sectores Río y Barranca, escaleras, mesa de control) puede
 * reemplazarse por coordenadas exportadas desde el plano CAD/PNG sin cambiar la UI.
 */

export interface PlateaSeatLayout {
  id: string;
  numeroVisible: number;
  sector: 'rio' | 'barranca';
  /** Posición normalizada 0–100 dentro del sector (para SVG) */
  x: number;
  y: number;
  w: number;
  h: number;
}

function blockSeats(
  sector: 'rio' | 'barranca',
  startNum: number,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
  cellW: number,
  cellH: number,
  gapX: number,
  gapY: number
): PlateaSeatLayout[] {
  const out: PlateaSeatLayout[] = [];
  let n = startNum;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        id: `${sector}-${n}`,
        numeroVisible: n,
        sector,
        x: originX + c * (cellW + gapX),
        y: originY + r * (cellH + gapY),
        w: cellW,
        h: cellH,
      });
      n += 1;
    }
  }
  return out;
}

/** ~120 asientos de muestra (60 por sector) + pasillo central simulado con hueco en coords */
export function getBasquetPlateasDemoLayout(): PlateaSeatLayout[] {
  const rio = [
    ...blockSeats('rio', 1, 10, 3, 2, 4, 3.2, 3.8, 0.35, 0.4),
    ...blockSeats('rio', 31, 10, 3, 38, 4, 3.2, 3.8, 0.35, 0.4),
  ];
  const barranca = [
    ...blockSeats('barranca', 296, 10, 3, 2, 52, 3.2, 3.8, 0.35, 0.4),
    ...blockSeats('barranca', 326, 10, 3, 38, 52, 3.2, 3.8, 0.35, 0.4),
  ];
  return [...rio, ...barranca];
}
