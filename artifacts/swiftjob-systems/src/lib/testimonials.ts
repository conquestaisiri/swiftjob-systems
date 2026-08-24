export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

/**
 * Up to 30 testimonial slots. Every slot starts as `null` — a card only
 * renders once a real quote is added here (quote/name/role from a client
 * or candidate who gave permission).
 */
export const TESTIMONIALS: (Testimonial | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];
