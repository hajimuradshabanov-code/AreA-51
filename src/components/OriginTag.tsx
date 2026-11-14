import type { MetricKey } from '../config/thresholds'
import type { DataOrigin } from '../data/types'
import { useTelemetrySelect } from '../hooks/useTelemetry'

const LABEL: Record<DataOrigin, { short: string; long: string }> = {
  reported: { short: 'FEED', long: 'reported by the telemetry backend' },
  modelled: { short: 'MODEL', long: 'modelled from NASA/NOAA data' },
  simulated: { short: 'SIM', long: 'simulated value, not a measurement' },
  measured: { short: 'SENSOR', long: 'measured on you by a connected sensor' },
  self: { short: 'SELF', long: 'entered by you' },
  device: { short: 'DEVICE', long: 'read from this device' },
  none: { short: 'NO SENSOR', long: 'no instrument connected for this value' },
}

const COLOR: Record<DataOrigin, string> = { reported: 'var(--ok)', measured: 'var(--ok)', modelled: 'var(--ok)', self: 'var(--ink)', device: 'var(--ink)', simulated: 'var(--warn)', none: 'var(--taupe)' }

export function useOrigin(k: MetricKey): DataOrigin {
  return useTelemetrySelect((s) => s.latest?.provenance?.[k] ?? 'simulated')
}

export const originText = (o: DataOrigin) => LABEL[o].long

/** Small badge stating where a value comes from (sensor, self-report, model, simulation …). */
export function OriginTag({ k }: { k: MetricKey }) {
  const o = useOrigin(k)
  return (
    <span
      className="label rounded px-1 py-px"
      title={LABEL[o].long}
      aria-label={LABEL[o].long}
      style={{ fontSize: 8, letterSpacing: '.12em', border: '1px solid var(--hair)', color: COLOR[o], whiteSpace: 'nowrap' }}
    >
      {LABEL[o].short}
    </span>
  )
}
