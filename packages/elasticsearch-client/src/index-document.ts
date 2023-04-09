import { getClient } from './client';

// TODO: This is hardcoded for now, but we should probably know both short codes and account sids
// and name everything based off of short_code instead of full account sid since it is unique.
// I didn't want to dig too deep in this PoC though.
import { convertDocument } from './config/as/convert-document-resources';

// TODO: handle document to body conversion based on a config file for this user/index

export const indexDocument = async ({
  shortCode = 'as',
  accountSid,
  indexType,
  id,
  document,
}: {
  shortCode?: string;
  accountSid: string;
  indexType: string;
  id: string;
  document: any;
}) => {
  const client = await getClient({ accountSid });

  const index = `${shortCode}-${indexType}`;

  const body = convertDocument(document);

  await client.index({
    index,
    id,
    body,
  });
};
