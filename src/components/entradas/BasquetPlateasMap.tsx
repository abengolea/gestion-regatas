"use client";

import type React from "react";
import type { PlateaSeatStatus } from "@/lib/types/entradas";
import type { PlateaSeatLayout } from "@/lib/entradas/basquet-plateas-layout";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<PlateaSeatStatus | "default", string> = {
  disponible: "fill-white stroke-slate-400 hover:fill-amber-50 cursor-pointer",
  reservado: "fill-amber-200 stroke-amber-500 cursor-pointer",
  reservado_manual: "fill-violet-100 stroke-violet-600 cursor-pointer",
  pagado: "fill-[#1B2A5E] stroke-[#243570] text-white cursor-pointer",
  abonado_fijo: "fill-slate-400 stroke-slate-600 text-white cursor-pointer",
  liberado_temporal: "fill-emerald-100 stroke-emerald-600 cursor-pointer",
  default: "fill-slate-100 stroke-slate-300 cursor-pointer",
};

export interface PlateaSeatView extends PlateaSeatLayout {
  estado: PlateaSeatStatus;
  titularNombre?: string;
}

interface BasquetPlateasMapProps {
  seats: PlateaSeatView[];
  /** Asientos resaltados (selección simple o múltiple) */
  selectedIds: string[];
  onSeatClick: (seatId: string, event: React.MouseEvent) => void;
  className?: string;
}

export function BasquetPlateasMap({ seats, selectedIds, onSeatClick, className }: BasquetPlateasMapProps) {
  const rio = seats.filter((s) => s.sector === "rio");
  const barranca = seats.filter((s) => s.sector === "barranca");

  return (
    <div className={cn("w-full overflow-x-auto rounded-lg border bg-[#f5f6f8] p-3", className)}>
      <p className="text-xs text-muted-foreground mb-1 text-center font-headline uppercase tracking-wide">
        Sector Río
      </p>
      <p className="text-[11px] text-muted-foreground mb-2 text-center">
        Clic en un asiento para abrir opciones. <strong className="font-medium text-foreground">Ctrl</strong> o{" "}
        <strong className="font-medium text-foreground">⌘</strong> + clic para elegir varios; después usá &quot;Reservar
        selección&quot;.
      </p>
      <svg viewBox="0 0 100 88" className="w-full max-h-[520px] touch-manipulation" role="img" aria-label="Plano de plateas">
        <title>Plano interactivo — sector Río, cancha y sector Barranca</title>
        <defs>
          <linearGradient id="cancha-parquet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8d5b8" />
            <stop offset="35%" stopColor="#d4bc96" />
            <stop offset="70%" stopColor="#c9aa82" />
            <stop offset="100%" stopColor="#b8956a" />
          </linearGradient>
          <linearGradient id="cancha-sombra" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#1a1a2e" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#1a1a2e" stopOpacity="0.07" />
          </linearGradient>
          <linearGradient id="key-paint-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3d5280" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#1B2A5E" stopOpacity="0.48" />
          </linearGradient>
        </defs>
        <Court />
        <g id="sector-rio">{rio.map((s) => seatRect(s, selectedIds, onSeatClick))}</g>
        <g id="sector-barranca">{barranca.map((s) => seatRect(s, selectedIds, onSeatClick))}</g>
      </svg>
      <p className="text-xs text-muted-foreground mt-1 text-center font-headline uppercase tracking-wide">
        Sector Barranca
      </p>
    </div>
  );
}

function seatRect(s: PlateaSeatView, selectedIds: string[], onSeatClick: (id: string, event: React.MouseEvent) => void) {
  const statusClass = STATUS_STYLES[s.estado] ?? STATUS_STYLES.default;
  const selected = selectedIds.includes(s.id);
  const fs = Math.max(1.8, Math.min(2.8, s.w * 0.55));
  return (
    <g
      key={s.id}
      className="cursor-pointer outline-none"
      onClick={(e) => onSeatClick(s.id, e)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSeatClick(s.id, e as unknown as React.MouseEvent);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <rect
        x={s.x}
        y={s.y}
        width={s.w}
        height={s.h}
        rx={0.35}
        className={cn(
          "transition-colors stroke-[0.12]",
          statusClass,
          selected && "stroke-crsn-orange stroke-[0.45]"
        )}
      />
      <text
        x={s.x + s.w / 2}
        y={s.y + s.h / 2 + fs * 0.35}
        textAnchor="middle"
        className={cn(
          "pointer-events-none select-none font-headline font-semibold",
          s.estado === "pagado" || s.estado === "abonado_fijo" ? "fill-white" : "fill-crsn-navy"
        )}
        style={{ fontSize: `${fs}px` }}
      >
        {s.numeroVisible}
      </text>
    </g>
  );
}

/**
 * Vista cenital estilo FIBA (28×15 m): largo en X, ancho en Y.
 * Coordenadas en unidades del viewBox, encajadas entre plateas.
 */
function Court() {
  const x0 = 3;
  const y0 = 16.8;
  const w = 94;
  const h = 37;
  /** Escala metro → px: largo 28 m en X, ancho 15 m en Y (los círculos reglamentarios son elipses en SVG). */
  const sx = w / 28;
  const sy = h / 15;
  const line = "stroke-[#ffffff] [stroke-width:0.22] fill-none [stroke-linecap:round] [stroke-linejoin:round]";
  const lineStrong =
    "stroke-[#ffffff] [stroke-width:0.36] fill-none [stroke-linecap:round] [stroke-linejoin:round]";

  const mx = (m: number) => x0 + m * sx;
  const my = (m: number) => y0 + m * sy;

  const cx = mx(14);
  const cy = my(7.5);
  const hoopLeftX = mx(1.575);
  const hoopRightX = mx(26.425);
  const hoopY = cy;
  const centerCircleRx = 1.8 * sx;
  const centerCircleRy = 1.8 * sy;
  const keyHalfM = 4.9 / 2;
  const keyW = 4.9 * sy;
  const keyDepth = 5.8 * sx;
  const raRx = 1.25 * sx;
  const raRy = 1.25 * sy;
  const ftM = 1.8;
  const ftRx = ftM * sx;
  const ftRy = ftM * sy;
  const threeRx = 6.75 * sx;
  const threeRy = 6.75 * sy;
  const rM = 6.75;
  /** Tramos rectos del triple paralelos al fondo, 0,9 m del borde (FIBA). */
  const threeSidelineOffsetM = 0.9;

  /** Intersección arco 6,75 m con la línea de fondo (eje X = 0 ó 28). */
  const threePointEndlineY = (endLineM: 0 | 28) => {
    const basketXM = endLineM === 0 ? 1.575 : 26.425;
    const dx = endLineM - basketXM;
    const inner = rM * rM - dx * dx;
    if (inner <= 0) return { yTop: 0, yBot: 15 };
    const d = Math.sqrt(inner);
    return { yTop: 7.5 - d, yBot: 7.5 + d };
  };

  /** Intersección del arco con la línea interior a 0,9 m del lateral (X = 0,9 / 27,1). */
  const threePointJoinY = (lineXM: number, basketXM: number) => {
    const d = lineXM - basketXM;
    const inner = rM * rM - d * d;
    if (inner <= 0) return { yTop: 0, yBot: 15 };
    const s = Math.sqrt(inner);
    return { yTop: 7.5 - s, yBot: 7.5 + s };
  };

  const left3 = threePointEndlineY(0);
  const right3 = threePointEndlineY(28);
  const joinL = threePointJoinY(threeSidelineOffsetM, 1.575);
  const joinR = threePointJoinY(28 - threeSidelineOffsetM, 26.425);
  const offL = threeSidelineOffsetM;
  const offR = 28 - threeSidelineOffsetM;

  /** Perímetro completo del triple lado izquierdo (esquinas + tramos 0,9 m + arcos). */
  const pathThreeLeft = [
    `M ${mx(0)} ${my(0)}`,
    `L ${mx(offL)} ${my(0)}`,
    `L ${mx(offL)} ${my(joinL.yTop)}`,
    `A ${threeRx} ${threeRy} 0 0 0 ${mx(0)} ${my(left3.yTop)}`,
    `A ${threeRx} ${threeRy} 0 0 1 ${mx(0)} ${my(left3.yBot)}`,
    `A ${threeRx} ${threeRy} 0 0 0 ${mx(offL)} ${my(joinL.yBot)}`,
    `L ${mx(offL)} ${my(15)}`,
    `L ${mx(0)} ${my(15)}`,
  ].join(" ");

  const pathThreeRight = [
    `M ${mx(28)} ${my(0)}`,
    `L ${mx(offR)} ${my(0)}`,
    `L ${mx(offR)} ${my(joinR.yTop)}`,
    `A ${threeRx} ${threeRy} 0 0 1 ${mx(28)} ${my(right3.yTop)}`,
    `A ${threeRx} ${threeRy} 0 0 0 ${mx(28)} ${my(right3.yBot)}`,
    `A ${threeRx} ${threeRy} 0 0 1 ${mx(offR)} ${my(joinR.yBot)}`,
    `L ${mx(offR)} ${my(15)}`,
    `L ${mx(28)} ${my(15)}`,
  ].join(" ");

  const boardLineCount = 22;

  return (
    <g id="cancha" pointerEvents="none">
      <rect x={x0} y={y0} width={w} height={h} rx={0.35} className="fill-[url(#cancha-parquet)] stroke-[#9c8060] [stroke-width:0.28]" />
      {/* Tablones horizontales (parquet), solo tonos madera — evita franjas verticales "cebra" */}
      {Array.from({ length: boardLineCount }, (_, i) => (
        <line
          key={`b-${i}`}
          x1={x0}
          x2={x0 + w}
          y1={y0 + ((i + 0.5) / boardLineCount) * h}
          y2={y0 + ((i + 0.5) / boardLineCount) * h}
          className="stroke-[#7a5c3e] opacity-[0.07]"
          strokeWidth={0.09}
        />
      ))}

      {/* Zona pintada: encima del parquet, gradiente azul legible (no bloque negro) */}
      <rect
        x={mx(0)}
        y={my(7.5 - keyHalfM)}
        width={keyDepth}
        height={keyW}
        fill="url(#key-paint-grad)"
        className="stroke-white/35 [stroke-width:0.14]"
      />
      <rect
        x={mx(28) - keyDepth}
        y={my(7.5 - keyHalfM)}
        width={keyDepth}
        height={keyW}
        fill="url(#key-paint-grad)"
        className="stroke-white/35 [stroke-width:0.14]"
      />

      <rect x={x0} y={y0} width={w} height={h} rx={0.35} className="fill-[url(#cancha-sombra)] stroke-none" />

      {/* Límites cancha (rectángulo 28×15 m claramente cerrado) */}
      <rect x={x0} y={y0} width={w} height={h} rx={0.35} className={lineStrong} />

      {/* Línea de medio campo */}
      <line x1={cx} x2={cx} y1={y0} y2={y0 + h} className={line} />

      {/* Círculo central (elipse en SVG = círculo reglamentario en planta) */}
      <ellipse cx={cx} cy={cy} rx={centerCircleRx} ry={centerCircleRy} className={line} />

      {/* Tableros */}
      <rect
        x={mx(0) - 0.35 * sx}
        y={my(7.5 - 1.8)}
        width={0.35 * sx}
        height={3.6 * sy}
        rx={0.08}
        className="fill-white stroke-[#cfd3dc] [stroke-width:0.08]"
      />
      <rect
        x={mx(28)}
        y={my(7.5 - 1.8)}
        width={0.35 * sx}
        height={3.6 * sy}
        rx={0.08}
        className="fill-white stroke-[#cfd3dc] [stroke-width:0.08]"
      />

      {/* Aros */}
      <circle cx={hoopLeftX} cy={hoopY} r={0.5} className="fill-[#E8531F] stroke-[#b83815] [stroke-width:0.12]" />
      <circle cx={hoopRightX} cy={hoopY} r={0.5} className="fill-[#E8531F] stroke-[#b83815] [stroke-width:0.12]" />

      {/* Línea de tiros libres y semicírculo restriction approx: rect + arc */}
      <line x1={mx(5.8)} x2={mx(5.8)} y1={my(7.5 - keyHalfM)} y2={my(7.5 + keyHalfM)} className={line} />
      <line x1={mx(22.2)} x2={mx(22.2)} y1={my(7.5 - keyHalfM)} y2={my(7.5 + keyHalfM)} className={line} />

      {/* Media luna área restringida (1,25 m) */}
      <path
        d={`M ${hoopLeftX} ${hoopY - raRy} A ${raRx} ${raRy} 0 0 1 ${hoopLeftX} ${hoopY + raRy}`}
        className={line}
      />
      <path
        d={`M ${hoopRightX} ${hoopY - raRy} A ${raRx} ${raRy} 0 0 0 ${hoopRightX} ${hoopY + raRy}`}
        className={line}
      />

      {/* Semicírculos de tiros libres */}
      <path
        d={`M ${mx(5.8)} ${my(7.5 - ftM)} A ${ftRx} ${ftRy} 0 0 0 ${mx(5.8)} ${my(7.5 + ftM)}`}
        className={line}
      />
      <path
        d={`M ${mx(22.2)} ${my(7.5 - ftM)} A ${ftRx} ${ftRy} 0 0 1 ${mx(22.2)} ${my(7.5 + ftM)}`}
        className={line}
      />

      <path d={pathThreeLeft} className={line} />
      <path d={pathThreeRight} className={line} />

      <text
        x={cx}
        y={cy + 1.05}
        textAnchor="middle"
        className="fill-[#5c6b8a]/55 font-headline font-semibold [font-size:2.2px] uppercase tracking-[0.12em] pointer-events-none"
      >
        CRSN
      </text>
    </g>
  );
}
