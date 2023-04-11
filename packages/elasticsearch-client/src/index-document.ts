import getConfig from './get-config';
import { getClient } from './client';

// TODO: handle document to body conversion based on a config file for this user/index

export const indexDocument = async ({
  accountSid,
  configId = 'default',
  document,
  id,
  indexType,
}: {
  accountSid: string;
  configId?: string;
  document: any;
  id: string;
  indexType: string;
}) => {
  const client = await getClient({ accountSid });

  const converter = await getConfig({
    configId,
    indexType,
    configType: 'convert-document',
  });

  const index = `${accountSid.toLowerCase()}-${indexType}`;

  const body = converter.convertDocument(document);

  const res = await client.index({
    index,
    id,
    body,
  });
};
