import Image from "next/image";

interface EscudoCRSNProps {
  /** Tamaño en píxeles (ancho y alto) */
  size?: number;
  /** Clases adicionales para el contenedor */
  className?: string;
}

export function EscudoCRSN({ size = 48, className = "" }: EscudoCRSNProps) {
  return (
    <span
      className={`block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/escudo-crsn.png"
        alt="Emblema oficial del Club Regatas San Nicolás con remos cruzados y corona de laureles"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </span>
  );
}
