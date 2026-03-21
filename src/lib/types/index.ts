export interface PlatformUser {
  id: string; // auth uid
  email: string;
  gerente_club: boolean;
  /** @deprecated Use gerente_club. Compatibilidad Firestore. */
  super_admin?: boolean;
  createdAt: Date;
}

/** Configuración global de la plataforma (solo super admin). */
export interface PlatformConfig {
  /** Mensaje mostrado cuando la plataforma está en mantenimiento. */
  maintenanceMessage?: string;
  /** Si true, se muestra el mensaje de mantenimiento y se limita el acceso. */
  maintenanceMode?: boolean;
  /** Si el registro web de nuevos jugadores está habilitado globalmente. */
  registrationEnabled?: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

/** Plantilla básica global de evaluaciones físicas (super admin). Tests predefinidos + los aceptados desde propuestas de entrenadores. */
export interface PhysicalAssessmentTemplate {
  /** Tests aceptados por super admin por grupo etario; una vez aceptados forman parte de la plantilla para todas las escuelas. */
  acceptedFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, PhysicalFieldDef[]>>;
  updatedAt?: Date;
  updatedBy?: string;
}

/** Entrada del log de auditoría (acciones relevantes del super admin). */
export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  subcomisionId?: string;
  details?: string;
  createdAt: Date;
}

export interface Subcomision {
  id: string;
  name: string;
  /** Slug URL para rutas públicas (ej. /escuelas/escuela-villa-crespo). */
  slug?: string;
  city: string;
  province: string;
  address: string;
  logoUrl?: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  schoolId: string;
  createdAt: Date;
}

// Representa la membresía y el rol de un usuario en una escuela específica.
export interface SubcomisionUser {
  id: string; // auth uid
  displayName: string;
  email: string;
  role: 'admin_subcomision' | 'encargado_deportivo' | 'editor' | 'viewer' | 'player';
  assignedCategories?: string[]; // IDs de las categorías asignadas
}

export type TipoSocio = 'general' | 'deportivo' | 'familiar';

export interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono?: string;
  fechaNacimiento?: string;
  foto?: string;

  /** Tipo base */
  tipoSocio: TipoSocio;

  /** Flags independientes del tipo */
  esFederado: boolean;
  esVitalicio: boolean;
  estaActivo: boolean;

  /** Subcomisiones a las que pertenece */
  subcomisiones: string[];

  /** Si es familiar, referencia al socio titular */
  socioTitularId?: string;

  /** QR y membresía */
  numeroSocio: string;
  qrToken?: string;
  fechaAlta: string;
  fechaVencimiento?: string;

  /** Campos heredados / compatibilidad */
  categoriaId?: string;
  /** Tira dentro de la categoría (ej. A, B, C) */
  tira?: string;
  subcomisionId?: string;
  fichasMedicas?: unknown[];
  escuelaId?: string;

  /** Legacy (mapear desde nombre/apellido para compatibilidad) */
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  status?: 'active' | 'inactive' | 'suspended';
  tutorContact?: { name: string; phone: string };
  photoUrl?: string;
  observations?: string;
  coachFeedback?: string;
  healthInsurance?: string;
  altura_cm?: number;
  peso_kg?: number;
  envergadura_cm?: number;
  mano_dominante?: 'derecho' | 'izquierdo' | 'ambidiestro';
  posicion_preferida?: 'arquero' | 'defensor' | 'lateral' | 'mediocampista' | 'delantero' | 'extremo';
  genero?: 'masculino' | 'femenino';
  numero_camiseta?: number;
  talle_camiseta?: string;
  createdAt?: Date;
  createdBy?: string;
  archived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  medicalRecord?: MedicalRecord;
}

/** Ficha médica del jugador (PDF). Subida por jugador o staff; aprobada o rechazada por admin/entrenador. */
export interface MedicalRecord {
  /** URL pública del PDF en Storage. */
  url: string;
  /** Ruta en Storage, ej: subcomisiones/{schoolId}/socios/{socioId}/medical-record.pdf */
  storagePath: string;
  uploadedAt: Date;
  /** UID de quien subió (jugador o staff). */
  uploadedBy: string;
  /** Si está definido, la ficha fue revisada y marcada cumplida por admin/entrenador. */
  approvedAt?: Date;
  approvedBy?: string;
  /** Si está definido, la ficha fue rechazada (incumplida); el jugador debe subir una nueva. */
  rejectedAt?: Date;
  rejectedBy?: string;
  /** Motivo del rechazo (ej. mal impresa, faltan datos). */
  rejectionReason?: string;
}

export interface PendingPlayer {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  /** Email verificado (obligatorio en registro web). */
  email: string;
  dni?: string;
  tutorContact: {
    name: string;
    phone: string;
  };
  submittedAt: Date;
  /** UID del usuario Auth que completó el registro. */
  submittedBy?: string;
}

/** Intentos temporales de verificación de email en registro web. Se eliminan tras verificar o expirar. */
export interface EmailVerificationAttempt {
  id: string;
  email: string;
  socioData: {
    firstName: string;
    lastName: string;
    birthDate: Date;
    schoolId: string;
    tutorPhone: string;
    category?: string;
  };
  status: 'pending' | 'verified' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

/** Solicitud de acceso al panel de un usuario ya logueado (ej. jugador que pide ser dado de alta). */
export interface AccessRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  type: "player";
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  /** Rellenado al aprobar: escuela y jugador vinculado. */
  approvedSchoolId?: string;
  approvedPlayerId?: string;
  approvedAt?: Date;
}


export interface Training {
  id: string;
  date: Date;
  /** Formato YYYY-MM-DD para consultas por fecha */
  dateStr?: string;
  /** Identificador del slot (cuando hay asistencia por turno) */
  slotKey?: string;
  createdAt: Date;
  createdBy: string; // uid
}

/** Slot de entrenamiento recurrente: día(s), horario, rango de categorías, cupo y entrenador asignado. */
export interface TrainingSlot {
  /** Nombre del grupo definido por la escuela (ej. "Lunes 16:00", "Arqueros", "Femenino") */
  name?: string;
  /** Día de la semana: 0=domingo, 1=lunes, ..., 6=sábado. Legacy; preferir daysOfWeek. */
  dayOfWeek: number;
  /** Días de la semana (0–6). Si está definido, reemplaza dayOfWeek y permite varios días. */
  daysOfWeek?: number[];
  /** Hora en formato "HH:mm" (ej. "17:00") */
  time?: string;
  /** Categoría inicial del rango (ej. "SUB-5"). Legacy; preferir yearFrom cuando esté definido. */
  categoryFrom: string;
  /** Categoría final del rango (ej. "SUB-10"). Legacy; preferir yearTo. */
  categoryTo: string;
  /** Año nacimiento mínimo (ej. 2015). Si está definido, reemplaza categoryFrom para filtrado. */
  yearFrom?: number;
  /** Año nacimiento máximo (ej. 2018). Si está definido, reemplaza categoryTo. */
  yearTo?: number;
  /** Tipo: masculino, femenino, arqueros. Arqueros = solo posicion_preferida "arquero". Vacío = mixto. */
  tipoCategoria?: 'masculino' | 'femenino' | 'arqueros';
  /** Cupo máximo de jugadores en este slot */
  maxQuota: number;
  /** UID del entrenador asignado. Legacy; preferir coachIds cuando esté definido. */
  coachId: string;
  /** IDs de entrenadores asignados (pueden ser varios por turno) */
  coachIds?: string[];
  /** IDs de jugadores agregados manualmente (fuera de reglas de año/género) */
  manualPlayerIds?: string[];
}

/** Configuración de horarios de entrenamiento por escuela. Almacenada en schools/{schoolId}/trainingConfig/default */
export interface TrainingConfig {
  id: string;
  slots: TrainingSlot[];
  updatedAt: Date;
  updatedBy: string;
}

export interface Attendance {
    id: string; // player id (document id)
    status: 'presente' | 'ausente' | 'justificado';
    reason?: string;
    /** Denormalizado para consulta por jugador en collectionGroup */
    playerId?: string;
    trainingId?: string;
    trainingDate?: Date;
}

/** Posición del jugador calificada por el entrenador. */
export type PlayerPosition = 'arquero' | 'defensor' | 'lateral' | 'mediocampista' | 'delantero' | 'extremo';

// Unifica todas las evaluaciones en un solo documento por fecha.
export interface Evaluation {
  id:string;
  playerId: string;
  date: Date;
  /** Posición que el entrenador califica como la más adecuada para el jugador. */
  position?: PlayerPosition;
  coachComments: string;
  /** Comentarios opcionales por rubro (ej. control, pase, respect). */
  rubricComments?: Record<string, string>;
  physical?: {
    height?: { value: number, unit: 'cm' };
    weight?: { value: number, unit: 'kg' };
    speed20m?: { value: number, unit: 's' };
    resistanceBeepTest?: { value: number, unit: 'level' };
    agilityTest?: { value: number, unit: 's' };
  };
  technical?: Record<string, number>; // Cambiado a number para los sliders
  tactical?: Record<string, number>;
  socioEmotional?: {
    respect?: number;
    responsibility?: number;
    teamwork?: number;
    empathy?: number;
    resilience?: number;
    learningAttitude?: number;
  };
  criticalIncident?: {
    type: 'verbal_aggression' | 'physical_aggression';
    comment: string;
    reportedBy: string; // uid
    reportedAt: Date;
  };
  createdAt: Date;
  createdBy: string; // uid
  /** Nombre del entrenador que realizó la evaluación (quien la hizo). */
  evaluatedByName?: string;
}


// Perfil de usuario unificado para usar en el frontend
export interface UserProfile extends SubcomisionUser {
    uid: string;
    isSuperAdmin: boolean;
    activeSubcomisionId?: string;
    /** @deprecated Use activeSubcomisionId */
    activeSchoolId?: string;
    memberships: SubcomisionMembership[];
    /** ID del socio cuando el rol es 'player'. */
    socioId?: string;
    /** @deprecated Use socioId */
    playerId?: string;
}

export interface SubcomisionMembership {
    subcomisionId: string;
    role: 'admin_subcomision' | 'encargado_deportivo' | 'editor' | 'viewer' | 'player';
}

/** Evaluación física del jugador. Campos varían según edad. */
export type PhysicalAgeGroup = '5-8' | '9-12' | '13-15' | '16-18';

/** Tests para 5–8 años */
export interface PhysicalTests58 {
  sprint_20m_seg?: number;
  salto_horizontal_cm?: number;
  equilibrio_seg?: number;
  circuito_coordinacion_seg?: number;
  observacion_coordinacion?: string;
}

/** Tests para 9–12 años */
export interface PhysicalTests912 {
  sprint_30m_seg?: number;
  salto_horizontal_cm?: number;
  salto_vertical_cm?: number;
  test_6min_metros?: number;
  test_agilidad_seg?: number;
}

/** Tests para 13–15 años */
export interface PhysicalTests1315 {
  sprint_10m_seg?: number;
  sprint_30m_seg?: number;
  course_navette_nivel?: number;
  salto_vertical_cm?: number;
  flexiones_1min?: number;
}

/** Tests para 16–18 años */
export interface PhysicalTests1618 {
  sprint_10m_seg?: number;
  sprint_30m_seg?: number;
  sprint_40m_seg?: number;
  cooper_metros?: number;
  yo_yo_nivel?: number;
  salto_vertical_cm?: number;
  plancha_seg?: number;
  observacion_asimetrias?: string;
}

export type PhysicalTests = PhysicalTests58 | PhysicalTests912 | PhysicalTests1315 | PhysicalTests1618;

/** Definición mínima de un campo personalizado o override (para config). */
export interface PhysicalFieldDef {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "text";
  min?: number;
  max?: number;
  placeholder?: string;
  category?: "velocidad" | "fuerza" | "resistencia" | "coordinacion" | "agilidad" | "flexibilidad" | "observacion";
}

/** Override de propiedades de un campo predefinido. */
export interface PhysicalFieldOverride {
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

/** Configuración de qué tests medir por escuela (encargado_deportivo puede activar/desactivar, agregar y editar). */
export interface PhysicalAssessmentConfig {
  id: string;
  /** Por grupo etario: array de keys de campos habilitados. Si vacío/ausente, se usan todos por defecto. */
  enabledFieldsByAgeGroup: Partial<Record<PhysicalAgeGroup, string[]>>;
  /** Tests personalizados agregados por el encargado_deportivo por grupo etario. */
  customFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, PhysicalFieldDef[]>>;
  /** Ediciones (label, unit, min, max) aplicadas a tests predefinidos por grupo. */
  fieldOverridesByAgeGroup?: Partial<Record<PhysicalAgeGroup, Record<string, PhysicalFieldOverride>>>;
  updatedAt: Date;
  updatedBy: string;
}

export interface PhysicalAssessment {
  id: string;
  playerId: string;
  date: Date;
  edad_en_meses: number;
  altura_cm: number;
  peso_kg: number;
  imc: number;
  observaciones_generales?: string;
  /** Tests según grupo de edad */
  tests: PhysicalTests;
  ageGroup: PhysicalAgeGroup;
  createdAt: Date;
  createdBy: string;
}

/** Video subido o grabado por el encargado deportivo, asociado a un socio (videoteca). */
export interface SocioVideo {
  id: string;
  socioId: string;
  /** Ruta en Firebase Storage, ej: subcomisiones/{subcomisionId}/socios/{socioId}/videos/{id}.webm */
  storagePath: string;
  /** URL pública de descarga/reproducción */
  url: string;
  /** Título opcional, ej. "Control de balón", "Entrenamiento 12/01" */
  title?: string;
  /** Descripción o notas del entrenador */
  description?: string;
  /** Habilidades/categorías: dribling, pegada, definicion, estirada, etc. */
  skills?: string[];
  createdAt: Date;
  createdBy: string;
}

// Re-export comercio types
export * from './comercio';

// Re-export posts types
export * from './posts';

// Re-export support types
export * from './support';
// Re-export payments types
export * from './payments';
// Re-export platform fee types
export * from './platform-fee';
// Re-export viaje types
export * from './viaje';
