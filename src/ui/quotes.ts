/** Quotes shown on the Reshuffle pop-up, one picked at random each time it opens (owner list). */
export interface Quote {
  readonly text: string;
  readonly author: string;
}

export const RESHUFFLE_QUOTES: readonly Quote[] = [
  {
    text: 'Some changes look negative on the surface, but you will soon realize that space is being created in your life for something new to emerge.',
    author: 'Eckhart Tolle',
  },
  { text: 'The art of life lies in a constant readjustment to our surroundings.', author: 'Kakuzo Okakura' },
  {
    text: 'In order to design a future of positive change, we must first become experts at changing our minds.',
    author: 'Jacque Fresco',
  },
  {
    text: 'Change is hard because people overestimate the value of what they have and underestimate the value of what they may gain by giving that up.',
    author: 'James Belasco and Ralph Stayer',
  },
];

export const randomQuote = (random: () => number = Math.random): Quote =>
  RESHUFFLE_QUOTES[Math.floor(random() * RESHUFFLE_QUOTES.length)] ?? RESHUFFLE_QUOTES[0]!;
