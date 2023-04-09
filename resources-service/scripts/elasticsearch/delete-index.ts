import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';
import { getClient } from '@tech-matters/elasticsearch-client';

const shortCode = process.argv[2] || 'as';

const deleteIndexIfExists = async () => {
  const accountSid = await getSsmParameter(
    `/${process.env.NODE_ENV}/twilio/${shortCode.toLocaleUpperCase()}/account_sid`,
  );

  const client = await getClient({ accountSid });

  const index = `${accountSid.toLowerCase()}-resources`;

  const indexExists = await client.indices.exists({ index });
  if (!indexExists) {
    console.log(`Index for ${shortCode} doesn't exist. Skipping deletion.`);
    return;
  }

  console.log(`Deleting index for ${shortCode}...`);
  await client.indices.delete({ index });
};

deleteIndexIfExists();
