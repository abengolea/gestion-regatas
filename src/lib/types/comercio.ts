export type EstadoConvenio = 'activo' | 'vencido' | 'rescindido' | 'pendiente';

export interface Comercio {
  id: string;
  razonSocial: string;
  cuit: string;
  rubro: string;
  domicilio: string;
  localidad: string;
  telefono: string;
  email: string;
  responsable: string;
  dniResponsable: string;
  instagram?: string;
  web?: string;
  logo?: string;

  /** Beneficio ofrecido */
  tipoBeneficio: string;
  porcentajeDescuento?: number;
  productosIncluidos: string;
  productosExcluidos?: string;
  diasHorarios?: string;
  condicionesEspeciales?: string;
  topeUsosMensuales?: number | null;

  /** Estado del convenio */
  estadoConvenio: EstadoConvenio;
  fechaInicio: string;
  fechaVencimiento: string;
  renovacionAutomatica: boolean;

  /** Metadata */
  creadoEn: string;
  actualizadoEn: string;
}
