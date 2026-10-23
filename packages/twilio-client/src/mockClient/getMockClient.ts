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

import RestException from 'twilio/lib/base/RestException';
import { chatMessageList } from './chatMessageList';
import { taskRouterWorkspaces } from './taskRouterWorkspaces';

export const getMockClient = ({ accountSid }: { accountSid: string }) => {
  return {
    tokens: {
      toJSON: () => ({
        accountSid,
      }),
    },
    chat: {
      v2: {
        services: () => ({
          channels: {
            get: () => ({
              messages: {
                list: () => chatMessageList,
              },
              members: {
                list: () => [],
              },
              remove: () => {},
            }),
          },
          users: {
            get: (identity: string) => {
              let userData: {
                sid: string;
                accountSid: string;
                serviceSid: string;
                attributes: string;
                friendlyName: string;
                roleSid: string;
                identity: string;
                isOnline: boolean;
                isNotifiable: boolean;
                dateCreated: Date;
                dateUpdated: Date;
                joinedChannelsCount: number;
                links: {
                  user_channels: string;
                  user_bindings: string;
                };
                url: string;
              };
              switch (identity) {
                case 'mockServiceUserIdentity':
                  userData = {
                    sid: 'US40ef90af89f848e882eff1dc0b4f1a4d',
                    accountSid: 'ACd8a2e89748318adf6ddff7df6948deaf',
                    serviceSid: 'IS43c487114db441beaad322a360117882',
                    attributes: '{}',
                    friendlyName: 'Anonymous',
                    roleSid: 'mockServiceUserRoleSid',
                    identity: 'mockServiceUserIdentity',
                    isOnline: true,
                    isNotifiable: false,
                    dateCreated: new Date('2022-11-30T15:04:09.000Z'),
                    dateUpdated: new Date('2022-11-30T15:04:22.000Z'),
                    joinedChannelsCount: 1,
                    links: {
                      user_channels:
                        'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/US40ef90af89f848e882eff1dc0b4f1a4d/Channels',
                      user_bindings:
                        'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/US40ef90af89f848e882eff1dc0b4f1a4d/Bindings',
                    },
                    url: 'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/US40ef90af89f848e882eff1dc0b4f1a4d',
                  };
                  break;
                case 'mockAdminUserIdentity':
                  userData = {
                    sid: 'USdafdc1c00a9244e3bdce2bf51b77907d',
                    accountSid: 'ACd8a2e89748318adf6ddff7df6948deaf',
                    serviceSid: 'IS43c487114db441beaad322a360117882',
                    attributes: '{}',
                    friendlyName: 'Isaac Asimov',
                    roleSid: 'mockAdminRoleSid',
                    identity: 'mockAdminUserIdentity',
                    isOnline: true,
                    isNotifiable: false,
                    dateCreated: new Date('2022-09-19T18:50:07.000Z'),
                    dateUpdated: new Date('2022-11-30T14:45:35.000Z'),
                    joinedChannelsCount: 3,
                    links: {
                      user_channels:
                        'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/USdafdc1c00a9244e3bdce2bf51b77907d/Channels',
                      user_bindings:
                        'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/USdafdc1c00a9244e3bdce2bf51b77907d/Bindings',
                    },
                    url: 'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Users/USdafdc1c00a9244e3bdce2bf51b77907d',
                  };
                  break;
                default:
                  // UGGGH. The twilio TS definition for RestException is wrong. It doesn't take the constructor override into account.
                  // @ts-ignore
                  throw new RestException({
                    statusCode: 404,
                    body: {
                      code: 20404,
                      message: `The requested resource /Services/IS43c487114db441beaad322a360117882/Users/${identity} was not found`,
                      more_info: 'https://www.twilio.com/docs/errors/20404',
                    },
                  });
              }
              return {
                fetch: () => Promise.resolve(userData),
              };
            },
          },
          roles: {
            get: (roleSid: string) => {
              let roleData: {
                sid: string;
                accountSid: string;
                serviceSid: string;
                friendlyName: string;
                type: string;
                permissions: Array<string>;
                dateCreated: Date;
                dateUpdated: Date;
                url: string;
              };

              switch (roleSid) {
                case 'mockServiceUserRoleSid':
                  roleData = {
                    sid: 'mockServiceUserRoleSid',
                    accountSid: 'ACd8a2e89748318adf6ddff7df6948deaf',
                    serviceSid: 'IS43c487114db441beaad322a360117882',
                    friendlyName: 'service user',
                    type: 'deployment',
                    permissions: ['createChannel', 'joinChannel', 'editOwnUserInfo'],
                    dateCreated: new Date('2019-12-17T09:58:37.000Z'),
                    dateUpdated: new Date('2019-12-17T09:58:37.000Z'),
                    url: 'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Roles/mockServiceUserRoleSid',
                  };
                  break;
                case 'mockAdminRoleSid':
                  roleData = {
                    sid: 'mockAdminRoleSid',
                    accountSid: 'ACd8a2e89748318adf6ddff7df6948deaf',
                    serviceSid: 'IS43c487114db441beaad322a360117882',
                    friendlyName: 'admin',
                    type: 'deployment',
                    permissions: [
                      'removeMember',
                      'inviteMember',
                      'addMember',
                      'editChannelAttributes',
                      'editOwnUserInfo',
                      'editAnyUserInfo',
                      'joinChannel',
                      'destroyChannel',
                    ],
                    dateCreated: new Date('2019-12-17T09:58:40.000Z'),
                    dateUpdated: new Date('2019-12-17T09:58:40.000Z'),
                    url: 'https://chat.twilio.com/v2/Services/IS43c487114db441beaad322a360117882/Roles/mockAdminRoleSid',
                  };
                  break;
                default:
                  throw new Error('Role not found');
              }

              return {
                fetch: () => Promise.resolve(roleData),
              };
            },
          },
        }),
      },
    },
    conversations: {
      v1: {
        conversations: {
          get: () => ({
            remove: () => Promise.resolve(true),
          }),
        },
      },
    },
    taskrouter: {
      workspaces: {
        list: () => Promise.resolve(taskRouterWorkspaces),
      },
    },
  };
};
