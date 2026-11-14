import { memo, useMemo, useState } from 'react'
import { Crosshair, Layers, Plus, Minus } from 'lucide-react'
import { useTelemetrySelect } from '../hooks/useTelemetry'
import { useDomId } from '../hooks/useDomId'
import { formatNumber } from '../lib/format'

const W = 340
const H = 230

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildContours() {
  const r = rng(51)
  const hills = [
    { x: 90, y: 70, n: 11, s: 9 },
    { x: 250, y: 150, n: 13, s: 8 },
    { x: 180, y: 40, n: 6, s: 7 },
    { x: 60, y: 190, n: 7, s: 8 },
  ]
  const paths: { d: string; o: number }[] = []
  for (const h of hills) {
    const ph = [r() * 6, r() * 6, r() * 6]
    for (let i = 1; i <= h.n; i++) {
      const base = i * h.s
      const pts: string[] = []
      for (let a = 0; a <= 72; a++) {
        const t = (a / 72) * Math.PI * 2
        const wob = 1 + 0.16 * Math.sin(2 * t + ph[0] + i * 0.2) + 0.1 * Math.sin(3 * t + ph[1]) + 0.06 * Math.sin(5 * t + ph[2])
        pts.push(`${(h.x + Math.cos(t) * base * wob * 1.25).toFixed(1)} ${(h.y + Math.sin(t) * base * wob * 0.8).toFixed(1)}`)
      }
      paths.push({ d: `M${pts.join('L')}Z`, o: 0.25 + (i / h.n) * 0.6 })
    }
  }
  return paths
}

const bez = (p: number[][], t: number) => {
  const u = 1 - t
  return [0, 1].map((i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i])
}
const SEG = [
  [[292, 38], [248, 52], [236, 108], [190, 124]],
  [[190, 124], [146, 140], [104, 168], [62, 184]],
]
const TRACK = (() => {
  const pts: number[][] = []
  for (const s of SEG) for (let i = 0; i <= 60; i++) pts.push(bez(s, i / 60))
  return pts
})()

const pointAt = (p: number) => TRACK[Math.round(Math.max(0, Math.min(1, p)) * (TRACK.length - 1))]

type Layer = 'contour' | 'thermal' | 'grid'
const LAYERS: Layer[] = ['contour', 'thermal', 'grid']

export const SurfaceMap = memo(function SurfaceMap({ tall = false, index = 0, height }: { tall?: boolean; index?: number; height?: number }) {
  const contours = useMemo(buildContours, [])
  const progress = useTelemetrySelect((s) => (Number.isFinite(s.latest?.progress) ? Math.min(1, Math.max(0, s.latest!.progress)) : 0))
  const dist = useTelemetrySelect((s) => s.latest?.distanceKm ?? NaN)
  const eta = useTelemetrySelect((s) => s.latest?.etaMin ?? NaN)
  const sol = useTelemetrySelect((s) => s.latest?.sol ?? 412)
  const [zoom, setZoom] = useState(1)
  const [layer, setLayer] = useState<Layer>('contour')
  const [ping, setPing] = useState(0)
  const headingId = useDomId('map-h')
  const glowId = useDomId('map-glow')
  const heatId = useDomId('map-heat')

  const idx = Math.round(progress * (TRACK.length - 1))
  const cur = TRACK[idx]
  const remaining = TRACK.slice(idx)
  const trail = TRACK.slice(0, idx + 1)
  const line = (pts: number[][]) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')
  const landing = TRACK[TRACK.length - 1]
  const [fx, fy] = [cur[0], cur[1]]
  const pillLeft = Math.min(Math.max(((fx - 150) / W) * 100 * 1 + (150 / W) * 100, 4), 56)

  return (
    <section className="glass rise relative overflow-hidden" style={{ ['--i' as string]: index }} aria-labelledby={headingId}>
      <header className="flex items-start justify-between p-4 pb-2">
        <div>
          <h2 id={headingId} className="display text-[20px]">
            Mars surface map
          </h2>
          <p className="label mt-1 num">18.65° N, 226.2° E · SOL {sol}</p>
        </div>
        <span className="label">{layer}</span>
      </header>
      <div className="relative" style={{ height: height ?? (tall ? 420 : 230) }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Topographic map showing path to landing site">
          <defs>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <radialGradient id={heatId} cx="50%" cy="50%" r="60%">
              <stop offset="0" stopColor="#ff6a1f" stopOpacity=".5" />
              <stop offset="1" stopColor="#7a2208" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#1a0f0a" />
          <g style={{ transform: `scale(${zoom})`, transformOrigin: `${fx}px ${fy}px`, transition: 'transform .5s cubic-bezier(.2,.7,.2,1)' }}>
            {layer === 'thermal' && (
              <>
                <circle cx="90" cy="70" r="110" fill={`url(#${heatId})`} />
                <circle cx="250" cy="150" r="120" fill={`url(#${heatId})`} />
              </>
            )}
            {layer === 'grid' &&
              Array.from({ length: 17 }, (_, i) => (
                <g key={i} stroke="rgba(255,170,120,.12)">
                  <line x1={i * 20} y1="0" x2={i * 20} y2={H} />
                  <line x1="0" y1={i * 20} x2={W} y2={i * 20} />
                </g>
              ))}
            <g filter={`url(#${glowId})`} fill="none" stroke="#ff6a1f" strokeWidth="1.6">
              {contours.map((c, i) => (
                <path key={i} d={c.d} opacity={c.o * 0.55} />
              ))}
            </g>
            <g fill="none" stroke="#ff9a52" strokeWidth=".7">
              {contours.map((c, i) => (
                <path key={i} d={c.d} opacity={c.o} />
              ))}
            </g>
            <path d={line(trail)} fill="none" stroke="rgba(242,233,225,.35)" strokeWidth="1.4" />
            <path d={line(remaining)} fill="none" stroke="#f2e9e1" strokeWidth="1.3" strokeDasharray="4 4" />
            <g transform={`translate(${landing[0]} ${landing[1]})`}>
              <rect x="-4" y="-4" width="8" height="8" transform="rotate(45)" fill="#1a0f0a" stroke="#f2e9e1" strokeWidth="1.2" />
              <text x="9" y="4" fill="#f2e9e1" fontSize="8" fontFamily="IBM Plex Mono" letterSpacing="1">
                LANDING SITE
              </text>
            </g>
            <g style={{ transform: `translate(${fx}px, ${fy}px)`, transition: 'transform 1s linear' }}>
              <circle r="11" fill="#ff4b3e" opacity=".18" key={ping}>
                <animate attributeName="r" values="5;16" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".4;0" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle r="4.5" fill="#ff4b3e" stroke="#f2e9e1" strokeWidth="1.2" />
            </g>
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,15,10,.5), transparent 25%, transparent 70%, rgba(26,15,10,.7))' }} />
        <div
          className="label num absolute whitespace-nowrap rounded-full px-3 py-1.5"
          style={{ left: `${pillLeft}%`, top: '14%', background: 'rgba(20,14,11,.8)', border: '1px solid var(--hair)', color: 'var(--ink)', transition: 'left 1s linear' }}
        >
          {formatNumber(dist, 1)} km · ETA {Number.isFinite(eta) ? `${eta} min` : '—'}
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          <button className="sq-btn" aria-label="Locate current position" onClick={() => { setPing((p) => p + 1); setZoom(1.6) }}>
            <Crosshair size={16} />
          </button>
          <button className="sq-btn" aria-label="Switch map layer" onClick={() => setLayer((l) => LAYERS[(LAYERS.indexOf(l) + 1) % LAYERS.length])}>
            <Layers size={16} />
          </button>
          <button className="sq-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.4))}>
            <Plus size={16} />
          </button>
          <button className="sq-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.4))}>
            <Minus size={16} />
          </button>
        </div>
        <div className="label absolute bottom-3 left-4 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
          <span style={{ width: 28 / zoom * 1.0 + 12, height: 6, borderLeft: '1px solid #f2e9e1', borderRight: '1px solid #f2e9e1', borderBottom: '1px solid #f2e9e1' }} />
          {(5 / zoom).toFixed(1)} km
        </div>
      </div>
    </section>
  )
})
