declare module 'text-se-image' {
  interface ModelConfig {
    id: string;
  }

  const generateImage: (prompt: string, model?: ModelConfig) => Promise<string>;
  export = generateImage;
}
