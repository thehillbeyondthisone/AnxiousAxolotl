export const MILESTONES = [
  { id: 'talk', event: 'talk', n: 1, reward: 10, title: 'Meet the Sewer Rat', hint: 'Walk near the rat and tap Talk.', area: 'campsite', target: 'rat' },
  { id: 'sell', event: 'sell', n: 3, reward: 25, title: 'Sell three snacks', hint: 'Search coolers, then sell the snacks to the rat.', area: 'campsite', target: 'rat' },
  { id: 'rod', event: 'rod', n: 1, reward: 0, title: 'Get a fishing rod', hint: 'Open Shop and buy the 60-pebble fishing rod.', area: 'campsite', target: 'rat' },
  { id: 'fish', event: 'fish', n: 1, reward: 20, title: 'Catch your first fish', hint: 'Stand on shore. Tap Reel, then hold and release to follow the fish.', area: 'campsite', target: 'lake' },
  { id: 'home', event: 'home', n: 1, reward: 10, title: 'Find your cabin', hint: 'Take the woods trail, then enter your cabin beside the pond.', area: 'woods', target: 'home' },
  { id: 'harvest', event: 'harvest', n: 1, reward: 25, title: 'Grow something good', hint: 'Plant and water a crop. Sleep in your free bed, water again, and repeat until Harvest appears.', area: 'woods', target: 'farm' },
  { id: 'decorate', event: 'decorate', n: 1, reward: 15, title: 'Make the cabin yours', hint: 'Buy a 20-pebble plant from the turtle vendor. In the cabin, open Decorate and place it.', area: 'woods', target: 'home' },
  { id: 'pump', event: 'pump', n: 1, reward: 0, title: 'A dry place to call home', hint: 'Buy the Bilge Pump from the turtle vendor.', area: 'woods', target: 'vendor', badge: true },
  { id: 'adopt', event: 'adopt', n: 1, reward: 0, title: 'A new friend', hint: 'Bring a meaty snack for the puppy or three fish for the kitten in the woods.', area: 'woods', target: 'home', badge: true },
  { id: 'play', event: 'play', n: 1, reward: 0, title: 'Play together', hint: 'At your cabin, open Pets and choose Play Together.', area: 'woods', target: 'home', badge: true },
  { id: 'farmhelp', event: 'farmhelp', n: 1, reward: 0, title: 'A helping shell', hint: 'Buy extra plots or a sprinkler from the turtle vendor.', area: 'woods', target: 'vendor', badge: true },
];

export class ProgressionTracker {
  constructor(data = {}) { this.counts = { ...data.counts }; this.claimed = new Set(data.claimed || []); }
  record(event, amount = 1) { this.counts[event] = Math.min(1e9, (this.counts[event] || 0) + Math.max(0, amount)); return this.claimReady(); }
  claimReady() {
    const newlyCompleted = [];
    for (const m of MILESTONES) {
      if ((this.counts[m.event] || 0) < m.n) break;
      if (!this.claimed.has(m.id)) { this.claimed.add(m.id); newlyCompleted.push(m); }
    }
    return newlyCompleted;
  }
  reconcile(profile) {
    const farmVisited = profile.homeFarmState?.length > 0;
    const homeOwned = ['hasHomePump','hasCatTree','hasTurtleCove','hasShellShelf','hasSunPatch'].some(k => profile[k]);
    const harvested = [...(profile.items || []), ...(profile.cabinStorage?.items || [])].some(i => ['Sproutroot','Berryvine','Goldwheat'].includes(i.name));
    const known = { talk: profile.scoreFoodSold > 0 || profile.stats?.questsCompleted > 0 ? 1 : 0, sell: profile.scoreFoodSold || 0, rod: profile.hasRod ? 1 : 0, fish: profile.stats?.fishCaught || 0, home: homeOwned || farmVisited || profile.cabinStorage?.items?.length ? 1 : 0, harvest: harvested ? 1 : 0, pump: profile.hasHomePump ? 1 : 0, adopt: profile.pets?.length || 0, farmhelp: profile.hasSprinkler || profile.hasExtraPlots ? 1 : 0 };
    for (const [key, n] of Object.entries(known)) this.counts[key] = Math.max(this.counts[key] || 0, n);
    // Proven legacy milestones are already rewarded, even when earlier unknown actions remain.
    for (const m of MILESTONES) if ((this.counts[m.event] || 0) >= m.n) this.claimed.add(m.id);
  }
  current() { return MILESTONES.find(m => !this.claimed.has(m.id)); }
  serialize() { return { counts: { ...this.counts }, claimed: [...this.claimed] }; }
}
