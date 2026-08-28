export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', module: 'analytics', icon: 'LayoutDashboard' },
  { href: '/leads', label: 'Leads', module: 'leads', icon: 'Inbox' },
  { href: '/emails', label: 'Emails', module: 'emails', icon: 'Mail' },
  { href: '/announcements', label: 'Notices', module: 'announcements', icon: 'Megaphone' },
  { href: '/appearance', label: 'Appearance', module: 'settings', icon: 'Palette' },
  { href: '/sections', label: 'Homepage', module: 'sections', icon: 'House' },
  { href: '/services', label: 'Services', module: 'services', icon: 'HeartPulse' },
  { href: '/providers', label: 'Providers', module: 'providers', icon: 'Stethoscope' },
  { href: '/insurance', label: 'Insurance', module: 'insurance', icon: 'Shield' },
  { href: '/testimonials', label: 'Reviews', module: 'testimonials', icon: 'Star' },
  { href: '/faqs', label: 'FAQs', module: 'faqs', icon: 'CircleHelp' },
  { href: '/locations', label: 'Locations', module: 'locations', icon: 'MapPin' },
  { href: '/telehealth-states', label: 'Telehealth States', module: 'telehealth_states', icon: 'Map' },
  { href: '/booking', label: 'Booking', module: 'booking', icon: 'CalendarDays' },
  { href: '/media', label: 'Media', module: 'media', icon: 'Image' },
  { href: '/videos', label: 'Videos', module: 'videos', icon: 'Video' },
  { href: '/blog', label: 'Blog', module: 'blog', icon: 'Newspaper' },
  { href: '/seo', label: 'SEO', module: 'seo', icon: 'Search' },
  { href: '/analytics', label: 'Analytics', module: 'analytics', icon: 'BarChart3' },
  { href: '/logs', label: 'Audit log', module: 'users', icon: 'ScrollText', superAdminOnly: true },
  { href: '/users', label: 'Staff', module: 'users', icon: 'Users', superAdminOnly: true },
] as const;

export const NAV_GROUPS = [
  { label: null, hrefs: ['/'] },
  { label: 'Inbox', hrefs: ['/leads', '/emails', '/announcements'] },
  {
    label: 'Website',
    hrefs: [
      '/appearance',
      '/sections',
      '/services',
      '/providers',
      '/insurance',
      '/testimonials',
      '/faqs',
      '/locations',
      '/telehealth-states',
      '/booking',
    ],
  },
  { label: 'Library', hrefs: ['/media', '/videos', '/blog'] },
  { label: 'Growth', hrefs: ['/seo', '/analytics'] },
  { label: 'System', hrefs: ['/logs', '/users'] },
] as const;

export type NavIconName = (typeof NAV_ITEMS)[number]['icon'];

export const STAFF_ACCESS = NAV_ITEMS.filter(
  (item) => !('superAdminOnly' in item && item.superAdminOnly) && item.href !== '/'
).map((item) => ({
  module: item.module,
  label: item.label,
  icon: item.icon,
}));

export const STAFF_MODULES = Array.from(new Set(STAFF_ACCESS.map((item) => item.module)));
