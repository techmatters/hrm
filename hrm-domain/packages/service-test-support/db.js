"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForDb = exports.clearAllTables = void 0;
const clearAllTables = async (db) => {
    try {
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
    }
    catch (err) {
        // Try to log out slightly more helpful error output if it's an AggregateError
        if (err instanceof AggregateError) {
            console.error(err);
            err.errors.forEach(e => console.error(e));
        }
        else {
            console.error(JSON.stringify(err));
        }
        throw err;
    }
};
exports.clearAllTables = clearAllTables;
const waitForDb = async (db) => {
    while (true) {
        try {
            const {} = await db.one('SELECT 1');
            return;
        }
        catch (err) {
            console.error('Database not ready, retrying in 1s');
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};
exports.waitForDb = waitForDb;
