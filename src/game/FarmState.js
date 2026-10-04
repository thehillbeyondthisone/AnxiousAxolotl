/** These operations work on live plots or the persisted off-screen snapshot. */
export function advanceCrops(plots) {
  for (const plot of plots || []) {
    if (!plot.crop) continue;
    if (plot.watered) plot.stage = Math.min(3, (plot.stage || 0) + 1);
    plot.watered = false;
  }
}
export function serviceCrops(plots, { day, servicedDay, turtleCove, sprinkler, force = false }) {
  if ((!turtleCove && !sprinkler) || (!force && servicedDay === day)) return servicedDay;
  const targets = (plots || []).filter(p => p.crop && p.stage < 3 && !p.watered).sort((a,b) => a.id.localeCompare(b.id));
  for (const plot of sprinkler ? targets : targets.slice(0,1)) plot.watered = true;
  return day;
}
