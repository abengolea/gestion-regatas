import { config } from 'dotenv';
config();

// Importa aquí los flujos que quieras que estén disponibles en el servidor de desarrollo.
import '@/ai/flows/physical-assessment-comparative-analytics';
import '@/ai/flows/extract-comercio-convenio';
import '@/ai/flows/complaint-response-suggest';
