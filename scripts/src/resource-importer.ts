import { promises as fsPromises } from 'fs';
import path from 'path';

export async function importItems<T>(
  directory: string,
  writeAction: (item: T) => Promise<void>,
  maxNumberOfItems?: number,
) {
  let processedConversations = 0;

  console.log('Processing directory:', directory);
  const directoryContents: string[] = await fsPromises.readdir(directory);

  directoryLoop: for (const directoryItem of directoryContents) {
    const itemPath = path.resolve(directory, directoryItem);
    const info = await fsPromises.stat(itemPath);
    if (info.isFile() && path.extname(itemPath) === '.json') {
      console.log('Importing from file:', itemPath);
      const fileItems: T[] = JSON.parse((await fsPromises.readFile(itemPath)).toString('utf8'));
      for (const item of fileItems) {
        await writeAction(item);

        if (maxNumberOfItems && ++processedConversations >= maxNumberOfItems) {
          break directoryLoop;
        }
      }
    }
  }
}
