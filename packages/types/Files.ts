const fileTypes = {
  recording: 'recording',
  transcript: 'transcript',
  caseFile: 'caseFile',
} as const;

export type FileTypes = (typeof fileTypes)[keyof typeof fileTypes];
