export type WorkflowStep = 'upload' | 'fabric' | 'subtitles';

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function logStepError(step: WorkflowStep, error: unknown): void {
  console.error(`[${step}]`, error);
}
