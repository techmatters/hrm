import { getProfilesSqlBase } from './profile-get-sql';

const RENOTIFY_PROFILE_SELECT_CLAUSE = `SELECT *
                                        FROM "Profiles" profiles
                                        WHERE profiles."accountSid" = $<accountSid>
                                            AND COALESCE(profiles."updatedAt", profiles."createdAt") BETWEEN COALESCE($<dateFrom>, '-infinity') AND COALESCE($<dateTo>, 'infinity')`;

export const getProfilesToRenotifySql = () =>
  `${getProfilesSqlBase(RENOTIFY_PROFILE_SELECT_CLAUSE, true)}
  ORDER BY COALESCE(profiles."updatedAt", profiles."createdAt")`;
