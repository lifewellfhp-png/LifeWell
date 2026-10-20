/**
 * [REVIEW]: every string below needs a native-speaker check before this
 * ships — see the final report's [REVIEW] list. Static for this pass
 * (not CMS-resolved) — see (es)/page.tsx's doc comment for why.
 */
export const heroEs = {
  heading: 'Atención compasiva de salud mental',
  subheading:
    'Evaluaciones psiquiátricas y manejo de medicamentos por telesalud en Florida, Massachusetts y Arizona, o en persona en Orlando.',
  badge: 'Aceptando nuevos pacientes',
};

export const servicesEs = [
  {
    title: 'Evaluaciones Psiquiátricas',
    description: 'Una evaluación completa para entender tus síntomas y planear el tratamiento adecuado.',
  },
  {
    title: 'Manejo de Medicamentos',
    description: 'Seguimiento continuo y ajustes de medicamentos para la ansiedad, depresión, TDAH y más.',
  },
  {
    title: 'Visitas de Seguimiento',
    description: 'Apoyo constante para mantener tu plan de tratamiento funcionando bien con el tiempo.',
  },
  {
    title: 'Consejería de Bienestar',
    description: 'Orientación personalizada sobre el sueño, el estrés y los hábitos diarios.',
  },
] as const;

export const howItWorksEs = {
  heading: 'Cómo Funciona',
  steps: [
    { title: 'Reserva tu cita', body: 'Elige un horario en línea o llámanos directamente.' },
    { title: 'Habla con tu proveedor', body: 'Por telesalud segura o en persona en nuestra oficina de Orlando.' },
    { title: 'Recibe tu plan de cuidado', body: 'Un plan claro y seguimiento continuo.' },
  ],
};

export const insuranceEs = {
  heading: 'Seguro y Pago',
  body: 'Aceptamos varios planes de seguro en Florida. Massachusetts y Arizona son solo de pago directo (self-pay). Consulta nuestra página de Tarifas y Seguro para los detalles completos.',
};
