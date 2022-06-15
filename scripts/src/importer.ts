import { promises as fsPromises } from 'fs';
import path from 'path';
import { JsonMessage } from './json-types';

export async function importConversations(
  conversationsDirectory: string,
  writeAction: (conversation: JsonMessage[]) => Promise<void>,
  maxNumberOfConversations: number,
) {
  let processedConversations = 0;

  console.log('Processing directory:', conversationsDirectory);
  const directoryContents: string[] = await fsPromises.readdir(conversationsDirectory);

  directoryLoop: for (const item of directoryContents) {
    const itemPath = path.resolve(conversationsDirectory, item);
    const info = await fsPromises.stat(itemPath);
    if (info.isFile() && path.extname(itemPath) === '.json') {
      console.log('Importing from file:', itemPath);
      const bookConversations: JsonMessage[][] = JSON.parse(
        (await fsPromises.readFile(itemPath)).toString('utf8'),
      );
      for (const conversation of bookConversations) {
        await writeAction(conversation);

        if (maxNumberOfConversations && ++processedConversations >= maxNumberOfConversations) {
          break directoryLoop;
        }
      }
    }
  }
}
