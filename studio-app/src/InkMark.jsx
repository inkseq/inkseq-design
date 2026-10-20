// The Inkseq ink-drop mark (owner choice 2026-10-20). One golden-ratio drop: bottom circle r,
// tip r*phi^2 above its centre, features at 0.618 of the height, leaning 8 degrees. The outline and
// the two brand colours never change; the face/pose varies by context ("variant").
// Colours follow the skin: the drop takes --accent and the features take --bg, unless a parent
// sets --ink-mark-body / --ink-mark-feat.
import React from 'react';

const DROP = 'M50 12 C47 27 28 46 28 70 A22 22 0 0 0 72 70 C72 46 53 27 50 12Z';
const BODY = { fill: 'var(--ink-mark-body, var(--accent))' };
const FEAT = { fill: 'var(--ink-mark-feat, var(--bg))' };
const FEAT_STROKE = { stroke: 'var(--ink-mark-feat, var(--bg))' };
const WINK_EYES = (
  <>
    <circle cx="42" cy="64" r="4.6" style={FEAT} />
    <path
      d="M52.5 58.5 L61 64 L52.5 69.5Z"
      style={{ ...FEAT, ...FEAT_STROKE }}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </>
);

const VARIANTS = {
  // Default mark: a round eye and a play-button eye.
  wink: (
    <g transform="rotate(-8 50 60)">
      <path d={DROP} style={BODY} />
      {WINK_EYES}
    </g>
  ),
  // Small sizes (16-32 px): only the play-button eye.
  play: (
    <g transform="rotate(-8 50 60)">
      <path d={DROP} style={BODY} />
      <path
        d="M45 56 L58.5 64.5 L45 73Z"
        style={{ ...FEAT, ...FEAT_STROKE }}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </g>
  ),
  // Generating: the drop falling, with speed lines.
  fall: (
    <>
      <path
        d="M14 40 H32 M8 52 H28 M16 64 H30"
        style={{ stroke: BODY.fill }}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <g transform="rotate(-20 52 60)">
        <path d={DROP} style={BODY} />
        {WINK_EYES}
      </g>
    </>
  ),
  // Done: smiling eyes, a play-button mouth.
  smile: (
    <g transform="rotate(-8 50 60)">
      <path d={DROP} style={BODY} />
      <path
        d="M38 60 q4 -5 8 0 M54 60 q4 -5 8 0"
        fill="none"
        style={FEAT_STROKE}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path d="M46.5 68 L55.5 73 L46.5 78Z" style={FEAT} />
    </g>
  ),
  // Festive: a brush-tip flick at the top.
  brush: (
    <g transform="rotate(-8 50 60)">
      <path
        d="M58 6 C66 10 60 18 52 16 C47 30 28 47 28 70 A22 22 0 0 0 72 70 C72 47 56 32 52 16"
        style={BODY}
      />
      {WINK_EYES}
    </g>
  ),
};

export const INK_MARK_VARIANTS = Object.keys(VARIANTS);

export default function InkMark({ variant = 'wink', size = 24, title, className = '' }) {
  const art = VARIANTS[variant] || VARIANTS.wink;
  return (
    <svg
      className={'ink-mark ' + className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {art}
    </svg>
  );
}
