import { getStackOutput } from './parseCdkOutput';

console.log(getStackOutput('contact-complete').queueUrl.replace('localhost', 'localstack'));
