/**
 * [REVIEW]: every string below needs a native-speaker check before this
 * ships. Static for this pass (not CMS-driven yet) — matches the same
 * 6 questions/answers proposed for the English faqs table (Part 2 item
 * 5 of the plan); translated here, not yet inserted as real rows
 * anywhere (that insertion needs an authenticated admin session — see
 * the final report).
 */
export const faqsEs = [
  {
    question: '¿Tratan el TDAH en adultos por telesalud en Florida?',
    answer:
      'Sí. La evaluación y el manejo de medicamentos para el TDAH en adultos están disponibles por telesalud para pacientes en Florida.',
  },
  {
    question: '¿Cuánto cuesta una evaluación psiquiátrica sin seguro?',
    answer:
      'La tarifa de pago directo (self-pay) para una evaluación psiquiátrica inicial varía según el estado — consulta nuestra página de Tarifas y Seguro para ver los precios exactos en Florida, Massachusetts y Arizona.',
  },
  {
    question: '¿Qué planes de seguro aceptan?',
    answer:
      'Aceptamos varios planes de seguro para pacientes en Florida. Massachusetts y Arizona son solo de pago directo (self-pay). Consulta nuestra página de Tarifas y Seguro para ver la lista completa de planes aceptados.',
  },
  {
    question: '¿En qué idiomas están disponibles las consultas?',
    answer: 'Las consultas se realizan en inglés, francés y criollo haitiano.',
  },
  {
    question: '¿En qué estados ofrecen telesalud?',
    answer:
      'Ofrecemos telesalud en Florida, Massachusetts y Arizona, con visitas en persona disponibles en nuestra oficina de Orlando, Florida.',
  },
  {
    question: '¿Qué sucede en la primera visita?',
    answer:
      'Tu primera visita incluye una evaluación completa de tu historial de salud, síntomas actuales y metas de tratamiento, para que juntos podamos desarrollar un plan de cuidado personalizado.',
  },
] as const;
