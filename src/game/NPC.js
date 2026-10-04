/**
 * NPC class represents Lifeguards and Security Guards.
 * Handles AI state machine (patrol, suspect, chase, search), 
 * vision cone geometry, and catching player.
 */
import { getCharacterSheet, CHAR_CELL } from './AssetLoader.js';

export class NPC {
  /**
   * @param {string} role - 'lifeguard' or 'security'
   * @param {Array} patrolPoints - Array of {x, y} coordinate objects
   */
  constructor(role, patrolPoints) {
    this.role = role;
    this.patrolPoints = patrolPoints;
    this.patrolIndex = 0;
    
    // Position
    this.x = patrolPoints[0].x;
    this.y = patrolPoints[0].y;
    this.radius = 18;
    this.angle = 0;

    // Movement speeds
    this.patrolSpeed = 65;
    this.chaseSpeed = 165;
    this.currentSpeed = this.patrolSpeed;

    // AI State Machine: 'patrol' | 'chase' | 'search' | 'idle' | 'decoy' | 'stunned'
    this.state = 'patrol';
    this.idleTimer = 0;
    this.searchTimer = 0;
    this.searchAngle = 0;
    this.stunTimer = 0; // seconds remaining while 'stunned'

    // Vision Properties
    this.visionDist = role === 'security' ? 220 : 170; // Security guards see further
    this.visionFov = 1.1; // Field of View in radians (~63 degrees)
    
    // Alert meter (0 = oblivious, 100 = full chase)
    this.alertLevel = 0;
    this.alertSpeed = 160; // How fast alert fills up when player is seen
    this.alertCooldown = 35; // How fast alert drops when player is hidden
  }

  /**
   * Update AI behavior
   * @param {number} dt - delta time in seconds
   * @param {object} player - references the Player object
   * @param {object} world - references the World object
   * @returns {boolean} - true if player is caught this frame
   */
  update(dt, player, world) {
    // Decay speech bubble timer
    if (this.speech && this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }

    if (player.isDead) {
      this.state = 'patrol';
      this.alertLevel = 0;
      return false;
    }

    // Stunned: frozen in place, oblivious, until the timer runs out
    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.state = 'patrol';
      }
      return false;
    }

    // 1. Vision Check
    const canSeePlayer = this.checkVisionOfPlayer(player, world);

    if (canSeePlayer) {
      // Alert level rises when player is seen
      this.alertLevel = Math.min(100, this.alertLevel + this.alertSpeed * dt);
      
      if (this.alertLevel >= 100) {
        this.state = 'chase';
        this.speech = '!';
        this.speechTime = 1.2;
        player.isHiding = false; // Dragged out of hiding if caught in the act!
      }
    } else {
      // Alert level drops when player is out of sight
      this.alertLevel = Math.max(0, this.alertLevel - this.alertCooldown * dt);

      if (this.state === 'chase' && this.alertLevel <= 0) {
        // Switch from chase to search when player breaks line of sight
        this.state = 'search';
        this.searchTimer = 3.0;
        this.speech = 'huh?';
        this.speechTime = 1.5;
      }
    }

    // 2. State Actions
    switch (this.state) {
      case 'patrol':
        this.handlePatrolling(dt, world);
        break;
      case 'idle':
        this.handleIdle(dt);
        break;
      case 'chase':
        this.handleChasing(dt, player, world);
        break;
      case 'search':
        this.handleSearching(dt);
        break;
      case 'decoy':
        this.handleDecoy(dt, world);
        break;
    }

    // 3. Catch Check (Physical collision) — open water is a safe harbor:
    // guards won't wade in themselves (_stepIfDry) and can't grab you at
    // the water's edge either, matching the invisibility rule above.
    // Sampled around the player's whole body (not just its exact center
    // point) so wading in at the shoreline counts, not just dead-center.
    const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
    const playerInWater = this._isNearWater(player, world);
    if (this.state === 'chase' && !playerInWater && distToPlayer < (this.radius + player.radius)) {
      return true; // Caught!
    }

    return false;
  }

  /**
   * True if any point around the player's body (not just its exact center)
   * sits on open water — so wading in at the shoreline counts as safe, not
   * just standing dead-center on a lake tile.
   */
  _isNearWater(player, world) {
    if (world.getTileAt(player.x, player.y) === world.TILE_LAKE) return true;
    const r = player.radius;
    const offsets = [[r, 0], [-r, 0], [0, r], [0, -r]];
    for (const [dx, dy] of offsets) {
      if (world.getTileAt(player.x + dx, player.y + dy) === world.TILE_LAKE) return true;
    }
    return false;
  }

  /**
   * Determine if player is inside the guard's vision cone
   */
  checkVisionOfPlayer(player, world) {
    // If player is hiding under a bush and guard is not right on top of them, they are invisible
    if (player.isHiding) {
      const dist = Math.hypot(this.x - player.x, this.y - player.y);
      if (dist > this.radius * 2.5) {
        return false;
      }
    }

    // Submerged in the open ocean, Axel is basically invisible to guards on
    // land — only a very close look (standing right over them) gives it
    // away. Deliberately ocean-only (TILE_LAKE): pools/ponds don't grant this,
    // so a swimming pool isn't a free escape route the way open water is.
    if (world.getTileAt(player.x, player.y) === world.TILE_LAKE) {
      const dist = Math.hypot(this.x - player.x, this.y - player.y);
      if (dist > this.radius * 2) {
        return false;
      }
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Out of range
    if (dist > this.visionDist) return false;

    // Check angle relative to guard's heading
    const angleToPlayer = Math.atan2(dy, dx);
    let diffAngle = angleToPlayer - this.angle;

    // Normalize angle to [-PI, PI]
    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

    // Check if within FOV half-angle
    if (Math.abs(diffAngle) > this.visionFov / 2) return false;

    // Line of sight raycast (rough check): Check if there is a cabin/wall blocking vision
    // For simplicity, check if the ray crosses cabin bounding boxes.
    for (const box of world.colliders) {
      if (box.type === 'cabin' || box.type === 'cafe') {
        if (this.rayIntersectsBox(this.x, this.y, player.x, player.y, box)) {
          return false; // Vision blocked!
        }
      }
    }

    return true;
  }

  /**
   * Simple ray intersection check against cabin colliders
   */
  rayIntersectsBox(x1, y1, x2, y2, box) {
    // Check if line (x1,y1)->(x2,y2) intersects bounding box
    const minX = box.x;
    const maxX = box.x + box.w;
    const minY = box.y;
    const maxY = box.y + box.h;

    // Standard bounding box intersection
    if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX)) return false;
    if ((y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) return false;

    // Check line equation intersections
    const m = (y2 - y1) / (x2 - x1 || 0.0001);
    const c = y1 - m * x1;

    // Intersection with left boundary
    const yLeft = m * minX + c;
    if (yLeft >= minY && yLeft <= maxY && ((x1 <= minX && minX <= x2) || (x2 <= minX && minX <= x1))) return true;

    // Intersection with right boundary
    const yRight = m * maxX + c;
    if (yRight >= minY && yRight <= maxY && ((x1 <= maxX && maxX <= x2) || (x2 <= maxX && maxX <= x1))) return true;

    // Intersection with top boundary
    const xTop = (minY - c) / m;
    if (xTop >= minX && xTop <= maxX && ((y1 <= minY && minY <= y2) || (y2 <= minY && minY <= y1))) return true;

    // Intersection with bottom boundary
    const xBot = (maxY - c) / m;
    if (xBot >= minX && xBot <= maxX && ((y1 <= maxY && maxY <= y2) || (y2 <= maxY && maxY <= y1))) return true;

    return false;
  }

  /**
   * Guards can't swim — never let a movement step land them on an ocean
   * tile. This is what actually makes open water an escape route: even a
   * guard mid-chase will refuse to wade in after the player.
   */
  _stepIfDry(nx, ny, world) {
    const resolved = world.checkCollisions(nx, ny, this.radius);
    if (world.getTileAt(resolved.x, resolved.y) === world.TILE_LAKE) return false;
    this.x = resolved.x;
    this.y = resolved.y;
    return true;
  }

  /**
   * Patrolling: Move smoothly from node to node
   */
  handlePatrolling(dt, world) {
    this.currentSpeed = this.patrolSpeed;
    const target = this.patrolPoints[this.patrolIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 5) {
      // Arrived! Pause and look around
      this.state = 'idle';
      this.idleTimer = 1.5; // Look around for 1.5 seconds
    } else {
      // Move towards patrol point
      this.angle = Math.atan2(dy, dx);
      const stepX = Math.cos(this.angle) * this.currentSpeed * dt;
      const stepY = Math.sin(this.angle) * this.currentSpeed * dt;
      this._stepIfDry(this.x + stepX, this.y + stepY, world);
    }
  }

  /**
   * Idle: Pause at patrol point and sweep head left/right
   */
  handleIdle(dt) {
    this.idleTimer -= dt;
    // Sweep vision back and forth
    this.angle += Math.sin(Date.now() / 150) * 0.03;

    if (this.idleTimer <= 0) {
      // Move to next patrol node
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
      this.state = 'patrol';
    }
  }

  /**
   * Chasing: Run directly at the player's last known location
   */
  handleChasing(dt, player, world) {
    this.currentSpeed = this.chaseSpeed;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    
    this.angle = Math.atan2(dy, dx);

    // Standard chase movement — guards balk at the shoreline (see _stepIfDry)
    const stepX = Math.cos(this.angle) * this.currentSpeed * dt;
    const stepY = Math.sin(this.angle) * this.currentSpeed * dt;
    this._stepIfDry(this.x + stepX, this.y + stepY, world);
  }

  /**
   * Sneak Stun Slingshot: freeze this guard in place, alert reset to zero,
   * for a few seconds. Reusable tool — the Game just calls this directly,
   * no consumable state to track here.
   */
  stun(seconds = 3.5) {
    this.state = 'stunned';
    this.stunTimer = seconds;
    this.alertLevel = 0;
    this.speech = '💫';
    this.speechTime = seconds;
  }

  /**
   * Decoy: hustle over to the Decoy Duck and stare at it, mesmerized.
   * The Game clears this state when the decoy expires.
   */
  handleDecoy(dt, world) {
    if (!this.decoyPt) { this.state = 'patrol'; return; }
    const dx = this.decoyPt.x - this.x;
    const dy = this.decoyPt.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 42) {
      // Arrived: tilt head at the duck
      this.angle = Math.atan2(dy, dx) + Math.sin(Date.now() / 250) * 0.08;
      return;
    }
    this.angle = Math.atan2(dy, dx);
    const s = this.patrolSpeed * 1.6;
    this._stepIfDry(this.x + Math.cos(this.angle) * s * dt, this.y + Math.sin(this.angle) * s * dt, world);
  }

  /**
   * Searching: Look around frantically when they lose the player
   */
  handleSearching(dt) {
    this.searchTimer -= dt;
    // Rapidly scan head left and right
    this.angle += Math.sin(this.searchTimer * 10) * 0.1;

    if (this.searchTimer <= 0) {
      this.state = 'patrol';
      this.alertLevel = 0;
    }
  }

  /**
   * Draw only the vision cone — called on the ground layer BEFORE Y-sorted entities
   */
  drawVisionCone(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Color is yellow normally, fades to red during alerts
    const intensity = this.alertLevel / 100;
    const r = Math.floor(251 + (4 - 251) * intensity);
    const g = Math.floor(191 + (68 - 191) * intensity);
    const b = Math.floor(36 + (68 - 36) * intensity);
    
    // Soft radial falloff so the cone reads as light, not a painted wedge
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, this.visionDist);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.28 + 0.2 * intensity})`);
    grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${0.1 + 0.12 * intensity})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, this.visionDist, -this.visionFov / 2, this.visionFov / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw the Guard body — called from Y-sorted entity list
   */
  draw(ctx) {
    ctx.save();
    
    // Calculate bouncing Y offset for 2.5D walk cycle
    const isMoving = (this.state === 'patrol' || this.state === 'chase');
    const bounceY = isMoving ? Math.abs(Math.sin(Date.now() / (this.state === 'chase' ? 80 : 150))) * -4 : 0;

    // Ground Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const sheet = getCharacterSheet(this.role);
    if (sheet) {
      // 4-direction pixel-art guard from the role-tinted character sheet.
      // Sheet rows: 0=down, 1=up, 2=left, 3=right; cols 0-1 idle, 2-3 walk.
      let row;
      if (Math.abs(Math.cos(this.angle)) > Math.abs(Math.sin(this.angle))) {
        row = Math.cos(this.angle) > 0 ? 3 : 2;
      } else {
        row = Math.sin(this.angle) > 0 ? 0 : 1;
      }
      const frameMs = this.state === 'chase' ? 110 : 220;
      const col = isMoving
        ? 2 + (Math.floor(Date.now() / frameMs) % 2)
        : (Math.floor(Date.now() / 450) % 2);
      const dest = 96;
      ctx.imageSmoothingEnabled = false;
      if (this.state === 'stunned') {
        // Knocked out — tipped over onto the ground instead of standing.
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(sheet, col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL,
          -dest / 2, -dest * 0.32, dest, dest);
        ctx.restore();
      } else {
        ctx.drawImage(sheet, col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL,
          this.x - dest / 2, this.y + bounceY - dest + 36, dest, dest);
      }
    } else {
    ctx.save();
    ctx.translate(this.x, this.y + bounceY);
    ctx.rotate(this.angle);
    if (this.state === 'stunned') ctx.rotate(Math.PI / 2);

    if (this.role === 'lifeguard') {
      // Draw Lifeguard (Red trunks, tan body, whistle)
      ctx.fillStyle = '#fdba74'; // Tan skin
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Red Swim shorts
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-4, 0, this.radius - 2, Math.PI/2, Math.PI * 1.5);
      ctx.fill();

      // Whistle string / strap
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(4, 0, 7, -Math.PI/2, Math.PI/2);
      ctx.stroke();

      // Silver whistle
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(8, -2, 4, 4);

    } else {
      // Draw Security Guard (Dark blue uniform, black belt, badge)
      ctx.fillStyle = '#1e3a8a'; // Dark blue uniform
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Black belt line
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, -this.radius, 4, this.radius * 2);

      // Gold badge
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.lineTo(8, -7);
      ctx.lineTo(8, -3);
      ctx.closePath();
      ctx.fill();

      // Flashlight beam (if chasing or searching)
      if (this.state === 'chase' || this.state === 'search') {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
        ctx.beginPath();
        ctx.moveTo(this.radius, 6);
        ctx.lineTo(this.radius + 80, 20);
        ctx.lineTo(this.radius + 80, -8);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(this.radius - 2, 4, 6, 4); // Flashlight casing
      }
    }

    // Sunglasses (Drawn on all guards)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(this.radius - 6, -6, 3, 4);
    ctx.fillRect(this.radius - 6, 2, 3, 4);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.radius - 5, -2);
    ctx.lineTo(this.radius - 5, 2);
    ctx.stroke();
    ctx.restore();
    }

    // Red alert indicator floating above head if alert level > 0
    if (this.alertLevel > 0) {
      ctx.save();
      ctx.translate(this.x, this.y + bounceY);

      const bounce = Math.sin(Date.now() / 100) * 3;
      ctx.fillStyle = this.state === 'chase' ? '#ef4444' : '#eab308';
      ctx.font = 'bold 20px Fredoka';
      ctx.textAlign = 'center';
      ctx.fillText(this.state === 'chase' ? '❗' : '❓', 0, -(sheet ? 62 : this.radius + 12) + bounce);
      ctx.restore();
    } else if (this.state === 'stunned') {
      ctx.save();
      ctx.translate(this.x, this.y + bounceY);
      const spin = Date.now() / 300;
      ctx.font = 'bold 18px Fredoka';
      ctx.textAlign = 'center';
      ctx.fillText('💫', Math.cos(spin) * 4, -(sheet ? 62 : this.radius + 12) + Math.sin(spin) * 2);
      ctx.restore();
    }

    ctx.restore();
  }
}
