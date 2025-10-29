declare module 'expo-file-system' {
  export const documentDirectory: string | null;
  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;
  // add other exports you rely on if needed
  export * from 'expo-file-system';
}
