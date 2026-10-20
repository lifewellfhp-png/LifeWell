/**
 * [REVIEW]: every string below needs a native-speaker check before this
 * ships. Medical/insurance terms especially — see the final report's
 * [REVIEW]/[CONFIRM] list. Never hardcode a price here — the Spanish
 * fees page reads live cms.fees data (see (es)/fees-insurance/page.tsx);
 * this file is descriptive copy only.
 */
export const feesEs = {
  heading: 'Tarifas y Seguro',
  intro:
    'Precios claros y por adelantado para la atención de pago directo (self-pay) y los planes de seguro aceptados, para que puedas planear tu visita con confianza.',
  selfPayHeading: 'Precios de Pago Directo (Self-Pay) por Estado',
  selfPayNote:
    'Evaluación inicial y visitas de seguimiento de manejo de medicamentos. [CONFIRM: escala móvil (sliding scale) — verificar disponibilidad exacta antes de publicar].',
  insuranceHeading: 'Seguro Aceptado (Solo Florida)',
  insuranceBody:
    'Aceptamos varios planes de seguro para pacientes en Florida. Massachusetts y Arizona son solo de pago directo (self-pay).',
  insuranceDisclaimer:
    'La cobertura de seguro y la participación en la red varían según el plan. Por favor contáctanos para verificar tus beneficios y elegibilidad antes de programar tu cita.',
  otherServicesHeading: 'Otros Servicios de Pago Directo',
};

/** Spanish labels for the 3 telehealth states — pricing figures
 * themselves are never translated/duplicated here; this only maps the
 * English state name (from cms.fees.psychiatricStatePricing) to its
 * Spanish display name. */
export const stateNamesEs: Record<string, string> = {
  Florida: 'Florida',
  Massachusetts: 'Massachusetts',
  Arizona: 'Arizona',
};
