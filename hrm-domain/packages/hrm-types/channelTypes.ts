/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

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
  modica: 'modica',
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
  channelTypes.modica,
];

export const isVoiceChannel = (channel: string) => channel === channelTypes.voice;
export const isChatChannel = (channel: string) => chatChannels.includes(channel as any);
