export const CREATE_DYNAMIC_USER_SQL = `
          CREATE ROLE $<user> WITH LOGIN PASSWORD $<password> VALID UNTIL 'infinity';
          GRANT $<role> TO $<user>`;
