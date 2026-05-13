class Renderer {
  constructor(canvas, world, entityManager, particles) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.em = entityManager;
    this.ps = particles;
    this.camera = { x: world.w / 2 - 20, y: CFG.SURFACE_Y - 10, zoom: 1.8 };
    this.ts = CFG.TILE_SIZE;
    this.time = 0;
    this.screenShake = { x: 0, y: 0, strength: 0 };
    this._offscreenLight = null;
    this._selectedEntity = null;
    this._tileVariation = new Uint8Array(world.w * world.h);
    for (let i = 0; i < this._tileVariation.length; i++) {
      this._tileVariation[i] = Math.floor(Math.random() * 20) - 10;
    }
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  render(time, dayPhase) {
    this.time = time;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.save();

    // Screen shake
    if (this.screenShake.strength > 0.1) {
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.strength;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.strength;
      this.screenShake.strength *= 0.88;
      ctx.translate(this.screenShake.x, this.screenShake.y);
    }

    ctx.clearRect(0, 0, W, H);

    // Sky background
    this._drawSky(dayPhase);

    // Tiles
    this._drawTiles(dayPhase);

    // Particles (world-space)
    this._drawParticles();

    // Entities
    this._drawEntities(dayPhase);

    // Atmosphere (depth fog, night overlay)
    this._drawAtmosphere(dayPhase);

    ctx.restore();
  }

  _drawSky(phase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cam = this.camera;
    const zoom = cam.zoom;
    const ts = this.ts * zoom;

    // Sky tiles - calculate sky region on screen
    const skyYWorld = 0;
    const skyYScreen = (skyYWorld - cam.y) * ts;
    const surfYScreen = (CFG.SURFACE_Y - cam.y) * ts;

    const skyGrad = ctx.createLinearGradient(0, skyYScreen, 0, Math.min(surfYScreen, H));

    // Day/night sky colors
    const sin = Math.sin(phase * Math.PI * 2);
    const isNight = phase > 0.55 || phase < 0.05;
    const isDawn = (phase > 0.05 && phase < 0.2) || (phase > 0.45 && phase < 0.6);

    if (isNight) {
      skyGrad.addColorStop(0, '#020410');
      skyGrad.addColorStop(1, '#080c1e');
    } else if (isDawn) {
      const t = phase < 0.2 ? (phase - 0.05) / 0.15 : 1 - (phase - 0.45) / 0.15;
      skyGrad.addColorStop(0, `rgb(${Math.floor(2 + 78 * t)}, ${Math.floor(4 + 96 * t)}, ${Math.floor(16 + 160 * t)})`);
      skyGrad.addColorStop(0.5, `rgb(${Math.floor(120 * t)}, ${Math.floor(40 * t)}, ${Math.floor(10 * t)})`);
      skyGrad.addColorStop(1, `rgb(${Math.floor(160 * t)}, ${Math.floor(80 * t)}, ${Math.floor(20 * t)})`);
    } else {
      skyGrad.addColorStop(0, '#0a1a4a');
      skyGrad.addColorStop(0.4, '#1a3a8a');
      skyGrad.addColorStop(1, '#3a6acc');
    }

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, Math.min(surfYScreen, H));

    // Stars at night
    if (isNight || (phase > 0.5 && phase < 0.7)) {
      const starAlpha = isNight ? 1 : Math.min(1, (phase - 0.5) * 10);
      ctx.fillStyle = `rgba(255, 255, 230, ${starAlpha})`;
      const rng = new Noise(42);
      for (let i = 0; i < 80; i++) {
        const sx = rng.rnd(i * 7, 1) * W;
        const sy = rng.rnd(i * 7, 2) * Math.min(surfYScreen, H) * 0.7;
        const size = rng.rnd(i, 3) < 0.85 ? 1 : 2;
        const twinkle = 0.5 + 0.5 * Math.sin(this.time * 0.05 + i * 1.3);
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // Sun or Moon
    const sunX = W * 0.1 + W * 0.8 * phase;
    const moonPhase = (phase + 0.5) % 1;
    const moonX = W * 0.1 + W * 0.8 * moonPhase;

    if (!isNight) {
      const sunY = surfYScreen * (0.15 + 0.15 * Math.sin((phase - 0.15) * Math.PI));
      ctx.save();
      // Sun glow
      const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 40);
      glow.addColorStop(0, 'rgba(255, 240, 100, 0.4)');
      glow.addColorStop(1, 'rgba(255, 200, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 40, sunY - 40, 80, 80);
      // Sun disk
      ctx.fillStyle = '#ffee44';
      ctx.beginPath(); ctx.arc(sunX, sunY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (isNight || phase > 0.55) {
      const moonY = surfYScreen * (0.15 + 0.15 * Math.sin((moonPhase - 0.15) * Math.PI));
      ctx.fillStyle = '#ddeeff';
      ctx.beginPath(); ctx.arc(moonX, moonY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#aabbcc';
      ctx.beginPath(); ctx.arc(moonX + 3, moonY - 2, 7, 0, Math.PI * 2); ctx.fill();
    }

    // Clouds
    this._drawClouds(phase);
  }

  _drawClouds(phase) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const cam = this.camera;
    const surfYScreen = (CFG.SURFACE_Y - cam.y) * this.ts * cam.zoom;
    if (surfYScreen < 0) return;

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#e8eef8';
    const cloudSeeds = [0, 1, 2, 3, 4, 5];
    for (const seed of cloudSeeds) {
      const cx = ((seed * W * 0.17 + this.time * 0.08) % (W + 200)) - 100;
      const cy = 20 + seed * 15;
      if (cy > surfYScreen) break;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 25, cy - 5, 16, 0, Math.PI * 2);
      ctx.arc(cx + 45, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawTiles(dayPhase) {
    const ctx = this.ctx;
    const cam = this.camera;
    const zoom = cam.zoom;
    const ts = this.ts * zoom;
    const W = this.canvas.width, H = this.canvas.height;

    const startX = Math.max(0, Math.floor(cam.x - 1));
    const endX   = Math.min(this.world.w - 1, Math.ceil(cam.x + W / ts + 1));
    const startY = Math.max(0, Math.floor(cam.y - 1));
    const endY   = Math.min(this.world.h - 1, Math.ceil(cam.y + H / ts + 1));

    const t = this.time;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = this.world.get(x, y);
        if (tile === T.AIR) continue;
        const data = TD[tile];
        if (!data || !data.color) continue;

        const sx = Math.floor((x - cam.x) * ts);
        const sy = Math.floor((y - cam.y) * ts);
        const tw = Math.ceil(ts) + 1;
        const th = Math.ceil(ts) + 1;

        // Color with variation
        let color = data.color;
        const vary = this._tileVariation[y * this.world.w + x];

        if (data.alpha && data.alpha < 1) {
          ctx.globalAlpha = data.alpha;
        }

        // Special animated tiles
        if (tile === T.WATER) {
          const wave = Math.sin(t * 0.08 + x * 0.5 + y * 0.3) * 0.04;
          const b = 180 + Math.floor(wave * 50);
          ctx.fillStyle = `rgb(30, 90, ${b})`;
          ctx.fillRect(sx, sy, tw, th);
          // Highlight
          ctx.fillStyle = `rgba(100, 160, 255, ${0.2 + Math.sin(t * 0.1 + x * 0.7) * 0.1})`;
          ctx.fillRect(sx + 1, sy + 1, tw - 2, 2);
        } else if (tile === T.LAVA) {
          const lv = Math.sin(t * 0.06 + x * 0.4 + y * 0.6);
          const r = 200 + Math.floor(lv * 30);
          const g = 50 + Math.floor(lv * 40);
          ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
          ctx.fillRect(sx, sy, tw, th);
          // Lava bubbles
          if (Math.sin(t * 0.3 + x * 1.7 + y * 2.3) > 0.85) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(sx + 3, sy + 3, 4, 4);
          }
        } else if (tile === T.FIRE) {
          const fv = Math.sin(t * 0.15 + x * 2.3 + y * 1.7);
          ctx.fillStyle = fv > 0 ? '#ff6600' : '#ff3300';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = `rgba(255, 200, 0, ${0.4 + fv * 0.3})`;
          ctx.fillRect(sx + 2, sy + 2, tw - 4, th - 4);
          // Emit particles
          if (Math.random() < 0.3) this.ps.emit(PT.FIRE, x, y - 0.5);
        } else if (tile === T.GRASS) {
          // Dirt base
          ctx.fillStyle = '#6b4428';
          ctx.fillRect(sx, sy, tw, th);
          // Grass top
          const gv = vary + 74;
          ctx.fillStyle = `rgb(${50 + vary}, ${gv + 30}, 30)`;
          ctx.fillRect(sx, sy, tw, Math.ceil(ts * 0.35));
          // Grass blades on surface
          if (ts > 12) {
            ctx.fillStyle = `rgb(${60 + vary}, ${gv + 40}, 20)`;
            for (let gx = 0; gx < tw - 2; gx += 3) {
              ctx.fillRect(sx + gx + 1, sy - 2, 1, 2);
            }
          }
        } else if (tile === T.LEAVES) {
          const lv2 = Math.sin(t * 0.04 + x * 0.3) * 0.05;
          const g = 100 + vary + Math.floor(lv2 * 20);
          ctx.fillStyle = `rgb(${30 + vary}, ${g}, ${20 + vary})`;
          ctx.fillRect(sx, sy, tw, th);
        } else if (data.ore) {
          // Stone base with ore flecks
          ctx.fillStyle = this._varyColor(color, vary);
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = data.ore;
          // Draw ore spots
          const ores = [{dx:2,dy:2,s:3},{dx:8,dy:5,s:2},{dx:4,dy:8,s:3},{dx:10,dy:2,s:2}];
          for (const o of ores) {
            const ox = sx + Math.floor(o.dx * zoom);
            const oy = sy + Math.floor(o.dy * zoom);
            const os = Math.max(1, Math.floor(o.s * zoom));
            ctx.fillRect(ox, oy, os, os);
          }
        } else if (tile === T.LOG) {
          ctx.fillStyle = '#3d2610';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = '#5a3c1a';
          ctx.fillRect(sx + Math.floor(tw * 0.25), sy, Math.floor(tw * 0.5), th);
        } else if (tile === T.TORCH) {
          ctx.fillStyle = '#5a3a20';
          const stick = Math.max(1, Math.floor(ts * 0.15));
          ctx.fillRect(sx + Math.floor(tw/2) - stick/2, sy + Math.floor(ts*0.2), stick, Math.floor(ts * 0.6));
          const flame = t * 0.1 + x * 0.7;
          ctx.fillStyle = Math.sin(flame) > 0 ? '#ffaa00' : '#ff6600';
          ctx.fillRect(sx + Math.floor(tw/2) - 2, sy + Math.floor(ts*0.1), 4, 4);
          if (Math.random() < 0.15) this.ps.emit(PT.FIRE, x, y - 0.3);
        } else if (tile === T.MUSHROOM) {
          // Stem
          ctx.fillStyle = '#ddbbaa';
          ctx.fillRect(sx + Math.floor(tw*0.35), sy + Math.floor(ts*0.5), Math.floor(tw*0.3), Math.floor(ts*0.5));
          // Cap
          ctx.fillStyle = '#cc2222';
          ctx.fillRect(sx + Math.floor(tw*0.1), sy + Math.floor(ts*0.1), Math.floor(tw*0.8), Math.floor(ts*0.45));
          ctx.fillStyle = '#ff6666';
          ctx.fillRect(sx + Math.floor(tw*0.2), sy + Math.floor(ts*0.15), Math.floor(tw*0.2), Math.floor(ts*0.2));
          ctx.fillRect(sx + Math.floor(tw*0.6), sy + Math.floor(ts*0.18), Math.floor(tw*0.15), Math.floor(ts*0.15));
        } else if (tile === T.CHEST) {
          ctx.fillStyle = '#7a4a20';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = '#c8a030';
          ctx.fillRect(sx + Math.floor(tw*0.1), sy + Math.floor(ts*0.35), Math.floor(tw*0.8), Math.floor(ts*0.12));
          ctx.fillRect(sx + Math.floor(tw*0.4), sy + Math.floor(ts*0.3), Math.floor(tw*0.2), Math.floor(ts*0.22));
        } else if (tile === T.BRICK) {
          ctx.fillStyle = this._varyColor('#7a3028', vary * 0.5);
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          const brickH = Math.max(1, Math.floor(ts * 0.3));
          for (let by2 = 0; by2 < th; by2 += brickH) {
            ctx.fillRect(sx, sy + by2, tw, 1);
          }
          ctx.fillRect(sx + Math.floor(tw/2), sy, 1, Math.floor(ts*0.3));
          ctx.fillRect(sx, sy + Math.floor(ts*0.3), 1, Math.floor(ts*0.3));
        } else if (tile === T.BEDROCK) {
          ctx.fillStyle = '#050510';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = '#0f0f1a';
          ctx.fillRect(sx + 1, sy + 1, Math.floor(tw/2), Math.floor(th/2));
        } else if (tile === T.ICE) {
          ctx.fillStyle = '#6898c8';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
          ctx.fillRect(sx + 2, sy + 2, Math.floor(tw * 0.3), 2);
        } else if (tile === T.SNOW) {
          ctx.fillStyle = '#d8e8e8';
          ctx.fillRect(sx, sy, tw, th);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(sx + 1, sy + 1, tw - 2, Math.floor(ts * 0.3));
        } else if (tile === T.DEEP_STONE) {
          const dv = vary;
          ctx.fillStyle = `rgb(${42 + dv}, ${42 + dv}, ${62 + dv})`;
          ctx.fillRect(sx, sy, tw, th);
        } else {
          ctx.fillStyle = this._varyColor(color, vary);
          ctx.fillRect(sx, sy, tw, th);
        }

        ctx.globalAlpha = 1;
      }
    }
  }

  _varyColor(hex, vary) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const v = vary * 0.5;
    return `rgb(${Math.max(0,Math.min(255,r+v))},${Math.max(0,Math.min(255,g+v))},${Math.max(0,Math.min(255,b+v))})`;
  }

  _drawParticles() {
    const ctx = this.ctx;
    const cam = this.camera;
    const zoom = cam.zoom;
    const ts = this.ts * zoom;

    for (const p of this.ps.particles) {
      const sx = (p.x - cam.x) * ts + ts * 0.5;
      const sy = (p.y - cam.y) * ts + ts * 0.5;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === PT.FIRE || p.type === PT.SPARK || p.type === PT.MAGIC || p.type === PT.HEAL) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
      }

      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size * zoom * 0.5, p.size * zoom * 0.5);
      ctx.restore();
    }
  }

  _drawEntities(dayPhase) {
    const ctx = this.ctx;
    const cam = this.camera;
    const zoom = cam.zoom;
    const ts = this.ts * zoom;
    const isNight = dayPhase > 0.65 || dayPhase < 0.15;

    for (const e of this.em.entities) {
      const sx = Math.floor((e.x - cam.x) * ts);
      const sy = Math.floor((e.y - cam.y) * ts);

      ctx.save();
      ctx.globalAlpha = e.deathAlpha || 1;

      const scale = zoom;
      ctx.translate(sx, sy);

      if (e.state === ES.DIE || !e.alive) {
        this._drawDeadTroglyte(ctx, e, scale, ts);
      } else {
        this._drawTroglyte(ctx, e, scale, ts, isNight);
      }

      // Health bar
      if (e.alive && e.health < e.maxHealth && ts > 10) {
        const bw = ts * 0.8;
        const bh = Math.max(2, zoom * 1.5);
        const bx = -bw / 2;
        const by = -ts * 0.65;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = e.health > 60 ? '#44cc44' : e.health > 30 ? '#cccc22' : '#cc2222';
        ctx.fillRect(bx, by, bw * (e.health / e.maxHealth), bh);
      }

      // Name above entity
      if (ts > 14 && e.alive) {
        ctx.fillStyle = e.isElder ? '#ffd700' : 'rgba(220, 230, 255, 0.9)';
        ctx.font = `${Math.max(6, Math.floor(zoom * 5))}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.fillText(e.name, 0, -ts * 0.72);
        ctx.shadowBlur = 0;
      }

      // Speech bubble
      if (e.speechTimer > 0 && e.speechText && ts > 10) {
        const alpha = Math.min(1, e.speechTimer / 20);
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        const tw = e.speechText.length * Math.max(5, zoom * 4) + 8;
        const bx2 = -tw / 2;
        const by2 = -ts - 18 * zoom;
        ctx.fillRect(bx2, by2, tw, 16 * zoom);
        ctx.fillStyle = '#1a1a2a';
        ctx.font = `${Math.max(5, Math.floor(zoom * 4.5))}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(e.speechText, 0, by2 + 11 * zoom);
      }

      // Selected highlight
      if (this._selectedEntity === e) {
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-ts * 0.5, -ts * 0.7, ts, ts);
      }

      ctx.restore();
    }
  }

  _drawTroglyte(ctx, e, scale, ts, isNight) {
    const w = ts * 0.55;
    const h = ts * 0.75;
    const x = -w / 2;
    const y = -h;

    // Walking animation
    const walkOffset = e.state === ES.WALK || e.state === ES.EXPLORE
      ? Math.sin(e.tickCount * 0.3) * 2 * scale
      : 0;
    const sleepOffset = e.state === ES.SLEEP ? 2 * scale : 0;

    ctx.save();
    if (sleepOffset > 0) ctx.translate(0, sleepOffset);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 2 * scale, ts * 0.05, w - 4 * scale, 3 * scale);

    // Legs
    const legW = w * 0.28, legH = h * 0.28;
    const leftLegOff  = walkOffset * 0.8;
    const rightLegOff = -walkOffset * 0.8;

    ctx.fillStyle = e.clothColor;
    ctx.fillRect(x + w * 0.1, -legH + leftLegOff, legW, legH);
    ctx.fillRect(x + w * 0.62, -legH + rightLegOff, legW, legH);

    // Body
    ctx.fillStyle = e.clothColor;
    ctx.fillRect(x + w * 0.08, -(h * 0.65), w * 0.84, h * 0.4);

    // Collar/shirt detail
    ctx.fillStyle = this._lighten(e.clothColor, 20);
    ctx.fillRect(x + w * 0.3, -(h * 0.65), w * 0.4, 2 * scale);

    // Arms
    const armAngle = e.state === ES.MINE
      ? Math.sin(e.tickCount * 0.5) * 0.5
      : walkOffset * 0.04;
    ctx.fillStyle = e.skinColor;
    ctx.save();
    ctx.translate(x, -(h * 0.6));
    ctx.rotate(armAngle + 0.2);
    ctx.fillRect(-4 * scale, 0, 4 * scale, h * 0.3);
    ctx.restore();
    ctx.save();
    ctx.translate(x + w, -(h * 0.6));
    ctx.rotate(-armAngle - 0.2);
    ctx.fillRect(0, 0, 4 * scale, h * 0.3);
    ctx.restore();

    // Pickaxe when mining
    if (e.state === ES.MINE) {
      ctx.fillStyle = '#8a8888';
      const pa = Math.sin(e.tickCount * 0.5) * 0.8;
      ctx.save();
      ctx.translate(x + w + 2 * scale, -(h * 0.55));
      ctx.rotate(pa - 0.3);
      ctx.fillRect(0, 0, 3 * scale, 8 * scale);
      ctx.fillStyle = '#c0a030';
      ctx.fillRect(-3 * scale, -2 * scale, 9 * scale, 3 * scale);
      ctx.restore();
    }

    // Head
    const headW = w * 0.85, headH = h * 0.38;
    const headX = x + (w - headW) / 2;
    const headY = -(h * 0.95);
    ctx.fillStyle = e.skinColor;
    ctx.fillRect(headX, headY, headW, headH);

    // Face details
    const eyeY = headY + headH * 0.35;
    const eyeW = Math.max(1, Math.floor(2 * scale));
    const eyeH = e.state === ES.SLEEP ? 1 : Math.max(1, Math.floor(2.5 * scale));

    // Left eye
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(headX + headW * 0.18, eyeY, eyeW + 1, eyeH + 1);
    ctx.fillStyle = e.eyeColor;
    ctx.fillRect(headX + headW * 0.18, eyeY, eyeW, eyeH);

    // Right eye
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(headX + headW * 0.62, eyeY, eyeW + 1, eyeH + 1);
    ctx.fillStyle = e.eyeColor;
    ctx.fillRect(headX + headW * 0.62, eyeY, eyeW, eyeH);

    // Eye glow at night
    if (isNight && e.alive) {
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = e.eyeColor;
      ctx.fillStyle = e.eyeColor;
      ctx.fillRect(headX + headW * 0.18, eyeY, eyeW, eyeH);
      ctx.fillRect(headX + headW * 0.62, eyeY, eyeW, eyeH);
      ctx.restore();
    }

    // Elder crown
    if (e.isElder) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(headX + headW * 0.1, headY - 4 * scale, headW * 0.8, 3 * scale);
      ctx.fillRect(headX + headW * 0.2, headY - 7 * scale, 3 * scale, 4 * scale);
      ctx.fillRect(headX + headW * 0.5, headY - 7 * scale, 3 * scale, 4 * scale);
      ctx.fillRect(headX + headW * 0.72, headY - 6 * scale, 3 * scale, 3 * scale);
    }

    ctx.restore();
  }

  _drawDeadTroglyte(ctx, e, scale, ts) {
    ctx.fillStyle = `rgba(100,100,120,${e.deathAlpha})`;
    ctx.fillRect(-ts * 0.3, -ts * 0.15, ts * 0.6, ts * 0.15);
    if (Math.random() < 0.05) this.ps.emit(PT.DUST, e.x, e.y - 0.2);
  }

  _lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1,3),16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3,5),16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5,7),16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  _drawAtmosphere(dayPhase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cam = this.camera;
    const zoom = cam.zoom;
    const ts = this.ts * zoom;

    // Underground darkness overlay
    const surfScreen = (CFG.SURFACE_Y - cam.y) * ts;
    if (surfScreen < H) {
      const darkStart = Math.max(0, surfScreen);
      const deepStart = (CFG.CAVE_START_Y - cam.y) * ts;

      if (darkStart < H) {
        const grad = ctx.createLinearGradient(0, darkStart, 0, H);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.15, 'rgba(0,0,4,0.3)');
        grad.addColorStop(0.5, 'rgba(0,0,8,0.65)');
        grad.addColorStop(1, 'rgba(0,0,12,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, darkStart, W, H - darkStart);
      }
    }

    // Night overlay
    const isNight = dayPhase > 0.65 || dayPhase < 0.15;
    if (isNight) {
      let alpha = 0;
      if (dayPhase > 0.65) alpha = Math.min(0.45, (dayPhase - 0.65) * 3);
      else alpha = Math.min(0.45, (0.15 - dayPhase) * 3);
      ctx.fillStyle = `rgba(0, 0, 20, ${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Lava glow overlay
    this._drawLavaGlow(ctx, cam, ts, W, H);
  }

  _drawLavaGlow(ctx, cam, ts, W, H) {
    const startX = Math.max(0, Math.floor(cam.x - 1));
    const endX   = Math.min(this.world.w - 1, Math.ceil(cam.x + W / ts + 1));
    const startY = Math.max(0, Math.floor(cam.y - 1));
    const endY   = Math.min(this.world.h - 1, Math.ceil(cam.y + H / ts + 1));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = this.world.get(x, y);
        if (tile !== T.LAVA && tile !== T.FIRE && tile !== T.TORCH) continue;

        const sx = (x - cam.x) * ts + ts * 0.5;
        const sy = (y - cam.y) * ts + ts * 0.5;
        const r = tile === T.LAVA ? 80 : (tile === T.FIRE ? 60 : 40);

        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * cam.zoom);
        const color = tile === T.TORCH ? '200, 120, 0' : '200, 80, 0';
        glow.addColorStop(0, `rgba(${color}, 0.15)`);
        glow.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(sx - r * cam.zoom, sy - r * cam.zoom, r * cam.zoom * 2, r * cam.zoom * 2);
      }
    }
  }

  worldToScreen(wx, wy) {
    const cam = this.camera;
    const ts = this.ts * cam.zoom;
    return {
      x: (wx - cam.x) * ts,
      y: (wy - cam.y) * ts
    };
  }

  screenToWorld(sx, sy) {
    const cam = this.camera;
    const ts = this.ts * cam.zoom;
    return {
      x: sx / ts + cam.x,
      y: sy / ts + cam.y
    };
  }

  shake(strength) {
    this.screenShake.strength = Math.max(this.screenShake.strength, strength);
  }

  setSelectedEntity(e) { this._selectedEntity = e; }
}
