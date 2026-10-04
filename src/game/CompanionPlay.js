/** Shared action-button minigame: three retrieves/pounces in twenty seconds. */
export class CompanionPlay {
  constructor(kind) { this.kind = kind; this.elapsed = 0; this.phase = 0; this.rounds = 0; this.animate = 0; this.done = false; this.result = null; }
  update(dt) {
    if (this.done) return;
    this.elapsed += dt; this.phase = (this.phase + dt * 0.55) % 1;
    this.animate = Math.max(0, this.animate - dt);
    if (this.elapsed >= 20) { this.done = true; this.result = 'timeout'; }
  }
  onAction() {
    if (this.done || this.animate > 0) return;
    if (this.phase >= 0.3 && this.phase <= 0.7) {
      this.rounds++; this.animate = 0.8;
      if (this.rounds >= 3) { this.done = true; this.result = 'success'; }
    }
  }
  draw(ctx, camera) {
    const w = Math.min(540, camera.w - 32), x = (camera.w - w) / 2, y = Math.max(30, camera.h / 2 - 100);
    ctx.save(); ctx.fillStyle = '#fff1db'; ctx.strokeStyle = '#795347'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, w, 190, 18); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#42302d'; ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillText(this.kind === 'puppy' ? 'Fetch with your puppy' : 'Toy chase with your kitten', camera.w / 2, y + 34);
    ctx.font = '16px Outfit, sans-serif'; ctx.fillText('Tap Play while the dot is in green', camera.w / 2, y + 60);
    ctx.fillStyle = '#d8c6b0'; ctx.fillRect(x + 30, y + 82, w - 60, 24);
    ctx.fillStyle = '#70bd86'; ctx.fillRect(x + 30 + (w - 60) * 0.3, y + 82, (w - 60) * 0.4, 24);
    ctx.fillStyle = '#397896'; ctx.beginPath(); ctx.arc(x + 30 + (w - 60) * this.phase, y + 94, 10, 0, Math.PI * 2); ctx.fill();
    ctx.font = '28px sans-serif';
    const hop = this.animate ? Math.sin((1 - this.animate / 0.8) * Math.PI) * 55 : 0;
    ctx.fillText(this.kind === 'puppy' ? '🐶' : '🐱', camera.w / 2 - 50 + hop, y + 145 - hop * 0.3);
    ctx.fillText(this.kind === 'puppy' ? '🎾' : '🐭', camera.w / 2 + 50, y + 145);
    ctx.font = '16px Outfit, sans-serif'; ctx.fillText(`${this.rounds}/3 · ${Math.max(0, Math.ceil(20 - this.elapsed))} seconds`, camera.w / 2, y + 175); ctx.restore();
  }
}
export function rewardCompanionPlay(pet, day, result) {
  if (result !== 'success' || pet.lastPlayRewardDay === day) return false;
  pet.happiness = Math.min(100, pet.happiness + 25); pet.hunger = Math.max(0, pet.hunger - 4); pet.lastPlayRewardDay = day;
  return true;
}
