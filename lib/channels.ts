export type Channel = 'nets_qr' | 'nets_click' | 'enets' | 'card' | 'sgqr'

export const CHANNELS: Channel[] = ['nets_qr', 'nets_click', 'enets', 'card', 'sgqr']

export const CHANNEL_LABELS: Record<Channel, string> = {
  nets_qr: 'NETS QR',
  nets_click: 'NETS Click',
  enets: 'eNETS (online)',
  card: 'Cards',
  sgqr: 'SGQR',
}
