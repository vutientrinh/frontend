const categoryArt: Record<
  string,
  { start: string; end: string; glyph: string }
> = {
  electronics: {
    start: "#38bdf8",
    end: "#2563eb",
    glyph:
      '<rect x="254" y="150" width="132" height="238" rx="24"/><path d="M286 180h68M302 356h36"/><circle cx="320" cy="333" r="5"/>',
  },
  home: {
    start: "#fbbf24",
    end: "#f97316",
    glyph:
      '<path d="m218 270 102-88 102 88v119H218z"/><path d="M282 389v-83h76v83M262 249h116"/>',
  },
  fashion: {
    start: "#fb7185",
    end: "#c026d3",
    glyph:
      '<path d="m267 207 53-28 53 28 46 44-34 36-28-24v130H263V263l-28 24-34-36z"/><path d="M294 185c0 30 52 30 52 0"/>',
  },
  beauty: {
    start: "#c084fc",
    end: "#7c3aed",
    glyph:
      '<path d="M290 174h60v48l28 31v136H262V253l28-31z"/><path d="M290 200h60M274 287h92M320 311v57"/>',
  },
  sports: {
    start: "#4ade80",
    end: "#059669",
    glyph:
      '<circle cx="320" cy="282" r="112"/><path d="m271 181 44 28 11 51-39 27-54-5M409 250l-50 10-33-27 9-50M349 391l-2-55 33-28 48 14M222 325l47-26 39 18 9 55-33 30"/>',
  },
  books: {
    start: "#fcd34d",
    end: "#d97706",
    glyph:
      '<path d="M202 222q59-25 118 8v173q-59-33-118-8zM438 222q-59-25-118 8v173q59-33 118-8z"/><path d="M235 255q35-11 61 2M235 287q35-11 61 2M344 257q28-14 60-3M344 289q28-14 60-3"/>',
  },
  toys: {
    start: "#fdba74",
    end: "#ea580c",
    glyph:
      '<circle cx="320" cy="270" r="73"/><circle cx="250" cy="206" r="31"/><circle cx="390" cy="206" r="31"/><path d="M226 349q94-73 188 0v63H226z"/><circle cx="294" cy="267" r="5"/><circle cx="346" cy="267" r="5"/><path d="M302 297q18 17 36 0"/>',
  },
  food: {
    start: "#bef264",
    end: "#16a34a",
    glyph:
      '<path d="M320 224c-17-37 4-77 53-91-2 45-19 72-53 91z"/><path d="M320 235c-89-64-149 8-114 101 28 75 80 108 114 72 34 36 86 3 114-72 35-93-25-165-114-101z"/><path d="M320 248v130"/>',
  },
};

const variants = [
  { rotation: -5, orbitX: 104, orbitY: 104 },
  { rotation: 3, orbitX: 440, orbitY: 136 },
  { rotation: 6, orbitX: 450, orbitY: 424 },
  { rotation: -3, orbitX: 112, orbitY: 442 },
];

function image(category: string, productIndex: number, imageIndex: number) {
  const art = categoryArt[category] ?? categoryArt.electronics;
  const variant = variants[(productIndex + imageIndex) % variants.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img">
    <defs>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="${art.start}"/><stop offset="1" stop-color="${art.end}"/>
      </linearGradient>
      <style>
        :root { color-scheme: light dark; }
        .ink { stroke: #0f172a; }
        .wash { fill: #ffffff; opacity: .55; }
        @media (prefers-color-scheme: dark) {
          .ink { stroke: #f8fafc; }
          .wash { fill: #0b1220; opacity: .4; }
        }
      </style>
    </defs>
    <circle cx="320" cy="320" r="198" fill="url(#accent)" opacity=".28"/>
    <circle cx="${variant.orbitX}" cy="${variant.orbitY}" r="25" fill="url(#accent)" opacity=".75"/>
    <circle cx="${640 - variant.orbitX}" cy="${640 - variant.orbitY}" r="13" fill="url(#accent)" opacity=".45"/>
    <path d="M114 472c112-36 300-36 412 0" fill="none" stroke="url(#accent)" stroke-width="3" opacity=".42"/>
    <ellipse cx="320" cy="434" rx="112" ry="19" class="wash"/>
    <g transform="rotate(${variant.rotation} 320 300)" fill="none" stroke="#f8fafc" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
      ${art.glyph}
    </g>
    <g transform="rotate(${variant.rotation} 320 300)" fill="none" class="ink" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
      ${art.glyph}
    </g>
    <rect x="156" y="482" width="328" height="10" rx="5" fill="url(#accent)" opacity=".42"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function productArtwork(category: string, productIndex: number) {
  return Array.from({ length: 4 }, (_, imageIndex) =>
    image(category, productIndex, imageIndex),
  );
}
