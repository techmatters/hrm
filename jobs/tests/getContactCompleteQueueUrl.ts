import { getStackOutput } from '../../cdk/cdkOutput';

console.log(getStackOutput('contact-complete').queueUrl.replace('localhost', 'localstack'));
