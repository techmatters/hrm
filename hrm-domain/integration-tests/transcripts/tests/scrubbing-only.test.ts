import { putS3Object } from '@tech-matters/s3-client';
import { purgeSqsQueue } from '@tech-matters/sqs-client';
import { getStackOutput } from '../../../../cdk/cdkOutput';
import { INPUT_TRANSCRIPT } from '../src/fixtures/sampleTranscripts';
import { addConversationMediaToContact, createContact } from '../src/contactDb';
import { MINIMAL_CONTACT } from '../src/fixtures/sampleContacts';
import { S3ContactMediaType } from '@tech-matters/hrm-types/dist/ConversationMedia';

jest.setTimeout(60000);

const completeOutput: any = getStackOutput('contact-complete');
const { queueUrl } = completeOutput;

beforeEach(async () => {
  await purgeSqsQueue({ queueUrl });
});

test('Retrieve contact job in progress and completed notification retrieved', async () => {
  // Arrange
  // Add unscrubbed transcript to S3 bucket
  await putS3Object({
    bucket: 'docs-bucket',
    key: 'transcripts/test-transcript.txt',
    body: JSON.stringify(INPUT_TRANSCRIPT),
  });
  // Add contact with unscrubbed transcript to Contact table
  const contact = await createContact(MINIMAL_CONTACT);
  const conversationMedia = await addConversationMediaToContact({
    contactId: contact.id,
    storeType: 'S3',
    storeTypeSpecificData: {
      location: {
        bucket: 'docs-bucket',
        key: 'transcripts/test-transcript.txt',
      },
      type: S3ContactMediaType.TRANSCRIPT,
    },
  });
  console.log(conversationMedia.id);
  // Add in progress retrieve transcript job to ContactJobs table

  // Act
  // Post a 'retrieve transcript complete' message on the completed jobs
  // Wait for a job to be pending on the scrub-transcript pending queue
  // Run the private AI container

  // Assert
  // Check that the original retrieve-transcript is marked as completed in the ContactJobs table
  // Check that a scrubbed transcript as written to the S3 bucket
  // Check that the scrub-transcript job is marked as completed in the ContactJobs table
  // Check that the scrubbed transcript has been linked as a conversation media item to the contact.
});
