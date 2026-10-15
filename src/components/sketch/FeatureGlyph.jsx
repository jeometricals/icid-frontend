import { flagOutline, svgPoints } from '../../lib/flagGeometry'
import { featureTypeLabel } from '../../data/flagEnums'

// The letters a feature type is marked with on the DOT key; the types not listed are drawn as a symbol
export const FEATURE_LETTERS = {
  utility_cover: 'U',
  manhole: 'MH',
  fire_alarm: 'FA',
  meter: 'M',
  sign_or_meter: 'S',
  mail_box: 'MB',
  telephone: 'TEL',
  cellar_door: 'CD',
  tree_pit: 'T',
  other: '?',
}

const INK = '#1f2937'
const DWU_PURPLE = '#7c3aed'

// The outline a sized feature's shape is drawn with, by how its area counts
const OUTLINE_STYLES = {
  subtract: { stroke: '#6b7280', dash: '4 3', fill: '#ffffff', fillOpacity: 0.6 },
  sits_on_top: { stroke: INK, dash: undefined, fill: 'none', fillOpacity: 0 },
  marker_only: { stroke: '#9ca3af', dash: '2 2', fill: 'none', fillOpacity: 0 },
}

/** A feature type's symbol, centred on (x, y), about `size` page pixels across. */
export function GlyphMark({ type, x, y, size }) {
  const r = size / 3
  switch (type) {
    case 'hydrant':
      return <circle data-glyph="hydrant" cx={x} cy={y} r={r} fill={INK} />
    case 'pole':
      return (
        <g data-glyph="pole">
          <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={INK} strokeWidth={size / 12} />
          <circle cx={x} cy={y} r={r / 3} fill={INK} />
        </g>
      )
    case 'grate':
      return (
        <g data-glyph="grate" stroke={INK} strokeWidth={size / 14}>
          <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill="#ffffff" />
          {[-0.5, 0, 0.5].map(step => (
            <line key={step} x1={x + step * r} y1={y - r} x2={x + step * r} y2={y + r} />
          ))}
        </g>
      )
    case 'detectable_warning':
      return (
        <g data-glyph="detectable_warning" fill={DWU_PURPLE}>
          {[-1, 0, 1].flatMap(row => [-1, 0, 1].map(col => (
            <circle key={`${row},${col}`} cx={x + col * r * 0.8} cy={y + row * r * 0.8} r={r / 4} />
          )))}
        </g>
      )
    default:
      return (
        <text
          data-glyph={type}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.55}
          fontWeight="700"
          fill={INK}
          stroke="#ffffff"
          strokeWidth={size / 10}
          paintOrder="stroke"
        >
          {FEATURE_LETTERS[type] ?? FEATURE_LETTERS.other}
        </text>
      )
  }
}

/**
 * One feature on the sketch, in native page pixels: a sized feature's outline (its shape at the page's scale; dashed
 * and whitened where its area comes off a flag, solid where it sits on top), then its symbol from the DOT key at its
 * place (letters such as U, MB, TEL, CD or T, a filled dot for a hydrant, a ringed dot for a pole, a barred square
 * for a grate, purple dots for a detectable warning unit) and its label beside it. Drawing only: it takes no clicks.
 * Props: feature, scale (px/ft, or null: the symbol is drawn without the outline), size (the symbol's size).
 */
export default function FeatureGlyph({ feature, scale, size }) {
  const outline = feature.shape ? flagOutline(feature, scale) : []
  const style = OUTLINE_STYLES[feature.area_impact] ?? OUTLINE_STYLES.marker_only
  const name = featureTypeLabel(feature.feature_type)
  return (
    <g data-testid="feature" data-feature-type={feature.feature_type} className="pointer-events-none">
      <title>{feature.label ? `${name} ${feature.label}` : name}</title>
      {outline.length > 0 && (
        <polygon
          points={svgPoints(outline)}
          fill={style.fill}
          fillOpacity={style.fillOpacity}
          stroke={style.stroke}
          strokeWidth="1.5"
          strokeDasharray={style.dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <GlyphMark type={feature.feature_type} x={feature.sketch_x} y={feature.sketch_y} size={size} />
      {feature.label && (
        <text
          x={feature.sketch_x + size * 0.6}
          y={feature.sketch_y - size * 0.4}
          fontSize={size * 0.45}
          fill={INK}
          stroke="#ffffff"
          strokeWidth={size / 12}
          paintOrder="stroke"
        >
          {feature.label}
        </text>
      )}
    </g>
  )
}
