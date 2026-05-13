class Noise {
  constructor(seed = 42) {
    this.seed = seed;
    this.p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let s = seed >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(a, b, t) { return a + t * (b - a); }

  _grad(h, x, y) {
    h &= 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  n2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this._fade(x), v = this._fade(y);
    const a = this.p[X] + Y, b = this.p[X + 1] + Y;
    return this._lerp(
      this._lerp(this._grad(this.p[a], x, y),     this._grad(this.p[b], x - 1, y),     u),
      this._lerp(this._grad(this.p[a + 1], x, y - 1), this._grad(this.p[b + 1], x - 1, y - 1), u),
      v
    );
  }

  fbm(x, y, octaves = 4, lac = 2.0, gain = 0.5) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      v += this.n2(x * freq, y * freq) * amp;
      max += amp; amp *= gain; freq *= lac;
    }
    return v / max;
  }

  ridged(x, y, octaves = 4) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      v += (1 - Math.abs(this.n2(x * freq, y * freq))) * amp;
      max += amp; amp *= 0.5; freq *= 2;
    }
    return v / max;
  }

  rnd(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h >>> 0) / 0xFFFFFFFF;
  }
}
