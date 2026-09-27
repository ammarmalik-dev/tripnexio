/**
 * Hero carousel photography — sourced from Unsplash (free to use under the
 * Unsplash License, no attribution required). These are placeholder-quality
 * stock shots to get the premium look in place now; swap for TripNexio's own
 * branded photography when the client provides it.
 */
export interface HeroSlide {
  src: string;
  alt: string;
  location: string;
}

// Worldwide positioning (client-locked, Homepage_FINAL_Locked_1of1.docx §1/§3):
// TripNexio is not UAE/GCC-only, so the hero rotates through global
// destinations across different continents rather than only Gulf cities —
// deliberately no single GCC-only image in this set.
export const heroSlides: HeroSlide[] = [
  {
    src: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=2000&q=80",
    alt: "Marina Bay Sands skyline at sunset",
    location: "Singapore",
  },
  {
    src: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=2000&q=80",
    alt: "Eiffel Tower over the Seine at dusk",
    location: "Paris, France",
  },
  {
    src: "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=2000&q=80",
    alt: "Manhattan skyline framed by the Brooklyn Bridge",
    location: "New York, USA",
  },
  {
    src: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?auto=format&fit=crop&w=2000&q=80",
    alt: "Tokyo Tower rising above the city skyline",
    location: "Tokyo, Japan",
  },
];
