/**
 * The screen-face shapes the robot's glyph shader can morph into, as GLSL signed-distance
 * functions in glass units (head space): a heart (love), a four-point sparkle star
 * (celebrate), a spinning loader ring (thinking) and the mouth's equaliser bars (speaking).
 *
 * Signed distances morph by mixing: the shader blends the pill's distance toward a shape's
 * distance by that shape's amount, so an eye melts smoothly into a heart and back, with the
 * same crisp edge, gold rim and glow the pill has. Included by `glyph-material.ts`.
 */
export const GLYPH_SHAPES = /* glsl */ `
  float sdHeart(vec2 p, float size) {
    vec2 q = vec2(abs(p.x), p.y + size * 0.55) / size;
    float d;
    if (q.y + q.x > 1.0) d = length(q - vec2(0.25, 0.75)) - 0.35355;
    else {
      vec2 a = q - vec2(0.0, 1.0);
      vec2 b = q - 0.5 * max(q.x + q.y, 0.0);
      d = sqrt(min(dot(a, a), dot(b, b))) * sign(q.x - q.y);
    }
    return d * size;
  }

  // A four-point star (iq's sdStar with n = 4): radius r, sharpness m (2 = square, larger = spikier).
  float sdStar4(vec2 p, float r, float spin) {
    float c = cos(spin), s = sin(spin);
    p = mat2(c, s, -s, c) * p;
    const float an = 3.141593 / 4.0;
    const float en = 3.141593 / 3.2;
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
    return length(p) * sign(p.x);
  }

  // A ring of radius r; the caller dims it into a comet tail that spins (the loader).
  float sdRing(vec2 p, float r, float width) {
    return abs(length(p) - r) - width;
  }

  // Five rounded bars centred on the mouth: round dots at h[i] = 0, maxHeight taller at 1.
  float sdBars(vec2 p, float spacing, float halfWidth, float maxHeight, float h[5]) {
    float d = 1e5;
    for (int i = 0; i < 5; i++) {
      vec2 q = p - vec2((float(i) - 2.0) * spacing, 0.0);
      vec2 halfSize = vec2(halfWidth, halfWidth + h[i] * maxHeight);
      vec2 e = abs(q) - halfSize + halfWidth;
      d = min(d, length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - halfWidth);
    }
    return d;
  }
`;
