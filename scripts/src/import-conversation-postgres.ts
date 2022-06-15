import pgPromise from 'pg-promise';
import { randomUUID } from 'crypto';
import { JsonMessage } from './json-types';
import { importConversations } from './importer';

const CONVERSATIONS_DIRECTORY = '../transcripts-poc/convo-json';
const DB_CONFIG = {
  password: null,
  username: 'hrm_transcripts',
  host: 'localhost',
  port: 5434,
  database: 'hrm_transcripts_db',
};
const LANGUAGE = 'en';

const pgp = pgPromise({});

export const db = pgp(
  `postgres://${encodeURIComponent(DB_CONFIG.username)}:${encodeURIComponent(DB_CONFIG.password)}@${
    DB_CONFIG.host
  }:${DB_CONFIG.port}/${encodeURIComponent(DB_CONFIG.database)}?&application_name=hrm-service`,
);

function generateConversationMetaData() {
  return {
    callerInformation: {
      firstName: '',
      lastName: '',
      phoneNumber: Math.random()
        .toString()
        .replace(/[^0-9+]/, ' '),
    },
  };
}

async function insertConversation(conversation: JsonMessage[]) {
  await db.tx(async connection => {
    const channelSid = randomUUID();

    const conversationInsertSql = pgp.helpers.insert(
      {
        metadata: generateConversationMetaData(),
        taskSid: randomUUID(),
        channelSid,
        contactId: randomUUID(),
      },
      null,
      'Conversations',
    );
    const cs = new pgp.helpers.ColumnSet(
      ['channelSid', 'conversationIndex', 'language', 'sender', 'timestamp', 'content'],
      { table: 'Messages' },
    );
    const messagesInsertSql = pgp.helpers.insert(
      conversation.map((message, conversationIndex) => ({
        timestamp: message.timestamp,
        content: message.message,
        sender: message.sender,
        language: LANGUAGE,
        conversationIndex,
        channelSid,
      })),
      cs,
    );
    await connection.batch([
      connection.none(conversationInsertSql),
      connection.none(messagesInsertSql),
    ]);
  });
}

async function main() {
  const [, , ...args] = process.argv;

  console.log('Parsing arguments.');
  if (args.length !== 1) {
    console.error(
      `Number of conversations not set, assuming entire contents of '${CONVERSATIONS_DIRECTORY}' is to be imported`,
    );
  }
  const maxNumberOfConversations = Number.parseInt(args.pop());

  await importConversations(CONVERSATIONS_DIRECTORY, insertConversation, maxNumberOfConversations);

  console.log('Updating search vectors.');
  await db.task(conn =>
    conn.none(`UPDATE "Messages" SET "content_tsvector" = to_tsvector('english', "content")`),
  );
}

main().catch(err => {
  throw err;
});
