export interface Destination {
  code: string;
  name: string;
  services: string;
  gradient: string;
  image: string;
  imageAlt: string;
}

/**
 * The six GCC markets are the locked scope from CLAUDE.md — not invented data.
 * "services" is a plain description of what we handle, not a price or a
 * processing-time claim (CLAUDE.md hard rule #1: never invent authoritative
 * domain data such as prices or processing times). Images are sourced,
 * license-free Unsplash photography of each country's skyline/landmark.
 */
export const destinations: Destination[] = [
  {
    code: "AE",
    name: "United Arab Emirates",
    services: "New Visa · Extension · Change",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(62 111 219 / 55%))",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Dubai skyline with Burj Khalifa at sunset",
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    services: "New Visa · Extension",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(52 211 153 / 35%))",
    image: "https://images.unsplash.com/photo-1669529250752-9f5b54b30491?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Al Faisaliah Tower in Riyadh, Saudi Arabia",
  },
  {
    code: "BH",
    name: "Bahrain",
    services: "New Visa · Change",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(248 113 113 / 35%))",
    image: "https://images.unsplash.com/photo-1713008975532-b379f8bd8c37?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Bahrain World Trade Center towers in Manama",
  },
  {
    code: "KW",
    name: "Kuwait",
    services: "New Visa · Extension",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(251 191 36 / 35%))",
    image: "https://images.unsplash.com/photo-1611837138577-d1eda6518d6f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Kuwait Towers against a blue sky",
  },
  {
    code: "OM",
    name: "Oman",
    services: "New Visa · Extension · Change",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(143 176 245 / 45%))",
    image: "https://images.unsplash.com/photo-1606813332135-228593b6e201?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Muttrah Corniche in Muscat, Oman at dusk",
  },
  {
    code: "QA",
    name: "Qatar",
    services: "New Visa · Extension",
    gradient: "linear-gradient(160deg, rgb(24 42 77 / 90%), rgb(62 111 219 / 45%))",
    image: "https://images.unsplash.com/photo-1429794890858-d3016a2bb73c?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Doha corniche skyline across the water",
  },
];
