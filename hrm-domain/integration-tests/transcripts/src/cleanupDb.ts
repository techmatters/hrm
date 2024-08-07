import { db } from './connectionPool';

export const clearAllTables = async () => {
  await Promise.all([
    db.none('DELETE FROM "public"."ConversationMedias"'),
    db.none('DELETE FROM "public"."ContactJobs"'),
    db.none('DELETE FROM "public"."ProfilesToProfileFlags"'),
    db.none('DELETE FROM "public"."ProfilesToIdentifiers"'),
    db.none('DELETE FROM "public"."ProfileSections"'),
    db.none('DELETE FROM "public"."CSAMReports"'),
  ]);
  await db.none('DELETE FROM "public"."Contacts"');
  await Promise.all([
    db.none('DELETE FROM "public"."Identifiers"'),
    db.none('DELETE FROM "public"."Cases"'),
    db.none('DELETE FROM "public"."Profiles"'),
  ]);
};
