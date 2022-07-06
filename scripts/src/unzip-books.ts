import { promises as fsPromises } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const ROOT_BOOK_DIRECTORY = '../../aleph.gutenberg.org';
const ROOT_BOOK_DIRECTORY_NAME = 'aleph.gutenberg.org';
const ROOT_UNZIPPED_DIRECTORY = '../../gutenberg-unzipped';
const RANDOMIZE = true;

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
  async function writeUnzippedFile(allText: string, targetFile: string): Promise<void> {
    console.log('Writing unzipped file', targetFile);
    const unzippedFile = await fsPromises.open(targetFile, 'w+');
    try {
      await unzippedFile.writeFile(allText);
    } catch (err) {
      console.error(err);
    } finally {
      await unzippedFile.close();
    }
  }

  try {
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
        console.log(
          filePath.slice(
            filePath.indexOf(ROOT_BOOK_DIRECTORY_NAME) + ROOT_BOOK_DIRECTORY_NAME.length,
          ),
        );
        const pathFromRoot = path.dirname(
          path.join(
            ROOT_UNZIPPED_DIRECTORY,
            filePath.slice(
              filePath.indexOf(ROOT_BOOK_DIRECTORY_NAME) + ROOT_BOOK_DIRECTORY_NAME.length,
            ),
          ),
        );
        console.log(pathFromRoot);
        await fsPromises.mkdir(pathFromRoot, { recursive: true });
        const targetPath = path.join(pathFromRoot, `${path.basename(filePath, '.zip')}.txt`);
        await writeUnzippedFile(archiveText, targetPath);
      }
      return true;
    });
  } catch (err) {
    console.error(`Error running script:`, err);
  }
}

main().catch(err => {
  throw err;
});
