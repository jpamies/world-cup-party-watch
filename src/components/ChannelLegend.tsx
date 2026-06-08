import type { ChannelId } from '../types/calendar'

const CHANNEL_LABELS: Record<ChannelId, string> = {
  dazn: 'DAZN',
  la1: 'La 1 TVE',
  'rtve-play': 'RTVE Play',
}

const CHANNEL_ORDER: ChannelId[] = ['dazn', 'la1', 'rtve-play']

export function ChannelLegend() {
  return (
    <aside className="legend-box" aria-label="Leyenda de canales de TV">
      <h2>Leyenda de canales</h2>
      <ul>
        {CHANNEL_ORDER.map((channel) => (
          <li key={channel}>
            <span className={`channel-pill channel-${channel}`}>{CHANNEL_LABELS[channel]}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
