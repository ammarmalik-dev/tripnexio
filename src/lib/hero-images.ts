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

export const heroSlides: HeroSlide[] = [
  {
    src: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=2000&q=80",
    alt: "Dubai skyline with Burj Khalifa at sunset",
    location: "Dubai, UAE",
  },
  {
    src: "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?auto=format&fit=crop&w=2000&q=80",
    alt: "Sheikh Zayed Grand Mosque in Abu Dhabi at twilight",
    location: "Abu Dhabi, UAE",
  },
  {
    src: "https://images.unsplash.com/photo-1429794890858-d3016a2bb73c?auto=format&fit=crop&w=2000&q=80",
    alt: "Doha corniche skyline across the water",
    location: "Doha, Qatar",
  },
  {
    src: "https://images.unsplash.com/photo-1609229862559-88fc0ac257ad?auto=format&fit=crop&w=2000&q=80",
    alt: "Golden sand dunes in the Arabian desert",
    location: "Arabian Desert",
  },
];
