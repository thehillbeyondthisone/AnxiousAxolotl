export const DISC_CATALOG = [
  {
    id: 'pond_skater',
    name: 'Pond Skater',
    cost: 0,
    desc: 'A free demo disc: skim the pond, grab motes, dodge junk.',
    accent: '#38bdf8',
  },
  {
    id: 'deep_channel',
    name: 'Deep Channel',
    cost: 75,
    desc: 'A quiet signal-diving experience with hidden fragments.',
    accent: '#5eead4',
  },
  {
    id: 'office_98',
    name: 'Office Simulator 98',
    cost: 110,
    desc: 'Stamp forms at exactly the wrong corporate speed.',
    accent: '#fbbf24',
  },
  {
    id: 'cozy_cat_room',
    name: 'Cozy Cat Room',
    cost: 0,
    desc: 'Relax and decorate a tiny room to attract cute cats.',
    accent: '#f472b6',
  },
  {
    id: 'nautical_solitaire',
    name: 'Nautical Solitaire',
    cost: 0,
    desc: 'A harbor-themed solitaire disc using the old nautical card set.',
    accent: '#0ea5e9',
  },
];

export function findDisc(id) {
  return DISC_CATALOG.find((d) => d.id === id) || DISC_CATALOG[0];
}
