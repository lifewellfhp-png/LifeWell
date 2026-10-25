'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { NavLink } from '@/types/content';
import { cn } from '@/lib/utils';

type FooterNavProps = {
  heading: string;
  links: NavLink[];
  subheading?: string;
  sublinks?: NavLink[];
  secondSubheading?: string;
  secondSublinks?: NavLink[];
  className?: string;
};

export function FooterNav({
  heading,
  links,
  subheading,
  sublinks,
  secondSubheading,
  secondSublinks,
  className,
}: FooterNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setOpen(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <nav aria-label={heading} className={cn('min-w-0', className)}>
      <div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`footer-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          onClick={() => setOpen((value) => !value)}
          className="relative flex min-h-11 w-full items-center justify-between gap-4 whitespace-nowrap pb-3 text-left font-heading text-[18px] font-normal leading-[1.3] text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-8 after:bg-[#4cc25a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:pointer-events-none"
        >
          <span>{heading}</span>
          <span className={cn('text-xl text-[#4cc25a] transition-transform md:hidden', open && 'rotate-180')} aria-hidden="true">
            ⌄
          </span>
        </button>
        <div id={`footer-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} hidden={!open} className="md:!block">
          <FooterLinks links={links} />
          {subheading && sublinks ? <FooterSubgroup heading={subheading} links={sublinks} /> : null}
          {secondSubheading && secondSublinks ? <FooterSubgroup heading={secondSubheading} links={secondSublinks} /> : null}
        </div>
      </div>
    </nav>
  );
}

function FooterLinks({ links }: { links: NavLink[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-1.5 md:mt-5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            prefetch
            className="inline-block min-h-8 py-1 font-body text-[15px] leading-[1.9] text-[#c9d4ec] no-underline hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FooterSubgroup({ heading, links }: { heading: string; links: NavLink[] }) {
  return (
    <div className="mt-6">
      <h4 className="font-body text-[12px] font-semibold uppercase tracking-[1.5px] text-[#9fb0d6]">{heading}</h4>
      <FooterLinks links={links} />
    </div>
  );
}
