import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';
import { getClient } from '@tech-matters/elasticsearch-client';

const shortCode = process.argv[2] || 'as';

const addIndexIfNotExists = async () => {
  const accountSid = await getSsmParameter(
    `/${process.env.NODE_ENV}/twilio/${shortCode.toLocaleUpperCase()}/account_sid`,
  );

  const client = await getClient({ accountSid });

  const index = `${accountSid.toLowerCase()}-resources`;

  if (await client.indices.exists({ index })) {
    console.log(`Index for ${shortCode}already exists, skipping creation.`);
    return;
  }

  const body = await require(`./index-config/${shortCode}.js`).body;

  console.log(`Creating index for ${shortCode}...`);
  await client.indices.create({
    index,
    body,
  });
};

addIndexIfNotExists();
