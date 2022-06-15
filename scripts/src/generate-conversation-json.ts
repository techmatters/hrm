import { promises as fsPromises } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { JsonMessage } from './json-types';

const MIN_CONVO_LENGTH = 2,
  MAX_CONVO_LENGTH = 50;
const MIN_MESSAGE_LENGTH = 2,
  MAX_MESSAGE_LENGTH = 300;
const EARLIEST_CONVO = new Date(2010, 0, 1);
const LATEST_CONVO = new Date();
const ROOT_BOOK_DIRECTORY = '../aleph.gutenberg.org';
const ROOT_JSON_DIRECTORY = '../transcripts-poc/convo-json';
const RANDOMIZE = true;

const randomInteger = (min: number, max: number): number =>
  Math.round(Math.random() * (max - min) + min);

const trimBook = (untrimmed: string) => {
  const untrimmedParts = untrimmed.split('*** START OF THIS PROJECT GUTENBERG EBOOK');
  return untrimmedParts[untrimmedParts.length - 1].split(
    '*** END OF THIS PROJECT GUTENBERG EBOOK',
  )[0];
};

async function recurseBookDirectories(
  directory: string,
  processor: (path: string) => Promise<boolean>,
): Promise<boolean> {
  console.log('Processing directory:', directory);
  const directoryContents: string[] = await fsPromises.readdir(directory);
  if (RANDOMIZE) {
    directoryContents.sort(() => Math.random() - 0.5);
  }
  for (const item of directoryContents) {
    const itemPath = path.resolve(directory, item);
    const info = await fsPromises.stat(itemPath);
    if (info.isDirectory()) {
      if (!isNaN(Number.parseInt(item))) {
        if (!(await recurseBookDirectories(itemPath, processor))) {
          return false;
        }
      }
    } else if (!(await processor(itemPath))) {
      console.log('FINISHED PROCESSING ON:', itemPath);
      return false;
    }
  }
  return true;
}

async function main() {
  const [, , ...args] = process.argv;

  if (args.length !== 1) {
    console.error(`[---------- ERROR ----------] Usage: scraper <number_of_files>`);
    return;
  }
  console.log('Parsing arguments.');
  const maxNumberOfConversations = Number.parseInt(args[0]);
  let conversationsWritten = 0,
    bookRecursion = 0;

  async function writeConversationsFile(allText: string, targetFile: string): Promise<void> {
    let pointer = 0,
      len = allText.length,
      firstConvoWritten = false;
    console.log('Writing conversation file', targetFile);
    const jsonFile = await fsPromises.open(targetFile, 'w+');
    try {
      await jsonFile.writeFile('[');
      let timestamp = new Date(randomInteger(EARLIEST_CONVO.valueOf(), LATEST_CONVO.valueOf()));
      let currentConvo: JsonMessage[] = [],
        currentConvoLength = randomInteger(MIN_CONVO_LENGTH, MAX_CONVO_LENGTH);
      while (pointer < len) {
        const messageEnd = pointer + randomInteger(MIN_MESSAGE_LENGTH, MAX_MESSAGE_LENGTH);
        try {
          const message: JsonMessage = {
            sender: Math.round(Math.random()) === 1 ? 'counsellor' : 'caller',
            message: allText.slice(pointer, Math.min(messageEnd, allText.length)),
            timestamp: timestamp.toISOString(),
          };
          currentConvo.push(message);

          if (
            currentConvo.length > currentConvoLength ||
            (messageEnd >= len && currentConvo.length > 0)
          ) {
            if (firstConvoWritten) {
              await jsonFile.writeFile(',');
            } else {
              firstConvoWritten = true;
            }
            await jsonFile.writeFile(JSON.stringify(currentConvo, null, 2));
            currentConvo = [];
            currentConvoLength = randomInteger(MIN_CONVO_LENGTH, MAX_CONVO_LENGTH);
            conversationsWritten++;

            if (conversationsWritten > maxNumberOfConversations) {
              break;
            }
          }
        } catch (err) {
          console.error(err);
        }
        pointer = messageEnd;
        timestamp = new Date(timestamp.valueOf() + randomInteger(100, 60000));
      }
    } finally {
      await jsonFile.writeFile(']');
      await jsonFile.close();
    }
  }

  try {
    while (conversationsWritten < maxNumberOfConversations) {
      console.log('Starting loading books.');
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      await recurseBookDirectories(ROOT_BOOK_DIRECTORY, async filePath => {
        console.log('Loading book file:', filePath, 'extension:', path.extname(filePath));
        if (path.extname(filePath) === '.zip') {
          const zip = new AdmZip(filePath);
          const archiveText = zip
            .getEntries()
            .map(entry => trimBook(entry.getData().toString('utf8')))
            .join('\n');
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          await writeConversationsFile(
            archiveText,
            `${ROOT_JSON_DIRECTORY}/${bookRecursion}-${path.basename(filePath, '.zip')}.json`,
          );
        }
        return conversationsWritten <= maxNumberOfConversations;
      });
      bookRecursion++;
    }
  } catch (err) {
    console.error(`Error running script:`, err);
  }
}

main().catch(err => {
  throw err;
});
