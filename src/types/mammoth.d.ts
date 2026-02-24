declare module 'mammoth' {
  type MammothMessage = { message: string };
  type ExtractRawTextResult = {
    value: string;
    messages?: MammothMessage[];
  };

  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractRawTextResult>;
}
