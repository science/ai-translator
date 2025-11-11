export function parseCliArgs(args) {
  const cliArgs = args.slice(2);

  let inputFile = null;
  let outputDir = 'output/';
  let chunkSize = 4000;
  let model = 'gpt-5-mini';

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];

    if (arg === '--output-dir') {
      outputDir = cliArgs[++i];
    } else if (arg === '--chunk-size') {
      chunkSize = parseInt(cliArgs[++i], 10);
    } else if (arg === '--model') {
      model = cliArgs[++i];
    } else if (!arg.startsWith('--')) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    throw new Error('Input file path is required');
  }

  return {
    inputFile,
    outputDir,
    chunkSize,
    model
  };
}
