// This should be in sync with the fronted (src/states/DomainConstants.ts)

export const channelTypes = {
  voice: 'voice',
  whatsapp: 'whatsapp',
  facebook: 'facebook',
  web: 'web',
  sms: 'sms',
  twitter: 'twitter',
  instagram: 'instagram',
  line: 'line',
  default: 'default',
} as const;

export const chatChannels = [
  channelTypes.whatsapp,
  channelTypes.facebook,
  channelTypes.web,
  channelTypes.sms,
  channelTypes.twitter,
  channelTypes.instagram,
  channelTypes.line,
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isVoiceChannel = (channel: string) => channel === channelTypes.voice;
export const isChatChannel = (channel: string) => chatChannels.includes(channel as any);
