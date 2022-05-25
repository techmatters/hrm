import { exportTranscriptsInRange } from './exportTranscriptsInRange';

/**
 * On a local server run the two following SQL statements to have some contact data to play with (real conversations are exported)
 *
 * INSERT INTO "Contacts" ("createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", "helpline", "channel", "conversationDuration", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid")
 * VALUES ('2022-05-25 17:44:12.891+00','2022-05-25 17:44:12.891+00','{}'::jsonb,'Admin','WKda44b83f664f511c927c0f0f35579dd2','Select helpline','web',29,'ACd8a2e89748318adf6ddff7df6948deaf','2022-05-25 17:43:00+00','WT281a9a7481f036b908dc47a1c8177754','WKda44b83f664f511c927c0f0f35579dd2','CH466d8050f71943efadc051b8e85dcf8d','IS43c487114db441beaad322a360117882');
 * INSERT INTO "Contacts" ("createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", "helpline", "channel", "conversationDuration", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid")
 * VALUES ('2022-05-23 17:43:13.991+00','2022-05-23 17:43:13.991+00','{}'::jsonb,'Admin','WKda44b83f664f511c927c0f0f35579dd2','Select helpline','web',29,'ACd8a2e89748318adf6ddff7df6948deaf','2022-05-25 17:43:00+00','WT472a4dba2127a55742454f71cb934b69','WKda44b83f664f511c927c0f0f35579dd2','CH6864e56a9da443f7a6ffb532ad3f6bb3','IS43c487114db441beaad322a360117882');
 *
 * Then you can compile the code and run (ommit the port if you are not using containerized DB)
 * ➜ POSTGRES_PORT=5433 node dist/transcripts/test-transcripts.js
 *
 * This should create 2 new transcript files in json format under hrm-service root folder.
 * Change dateFrom and dateTo to produce different results
 */

// const dateFrom = new Date('2022-05-24').toISOString();
// const dateTo = new Date('2022-05-24').toISOString();
const dateFrom = null;
const dateTo = null;

async function main() {
  console.log('Calling the export');
  await exportTranscriptsInRange({ dateFrom, dateTo });
}

main();
