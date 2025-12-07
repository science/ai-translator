export function parseCliArgs(args) {
  const cliArgs = args.slice(2);

  let inputFile = null;
  let outputDir = 'output/';
  let chunkSize = 4000;
  let model = 'gpt-5-mini';
  let reasoningEffort = 'medium';
  let rectify = false;
  let pdfToMd = false;
  let contextAware = true;
  let targetLanguage = undefined;

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];

    if (arg === '--output-dir') {
      outputDir = cliArgs[++i];
    } else if (arg === '--chunk-size') {
      chunkSize = parseInt(cliArgs[++i], 10);
    } else if (arg === '--model') {
      model = cliArgs[++i];
    } else if (arg === '--reasoning-effort') {
      reasoningEffort = cliArgs[++i];
    } else if (arg === '--rectify') {
      rectify = true;
    } else if (arg === '--pdf-to-md') {
      pdfToMd = true;
    } else if (arg === '--no-context') {
      contextAware = false;
    } else if (arg === '--to' || arg === '-t') {
      targetLanguage = cliArgs[++i];
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    throw new Error('Input file path is required');
  }

  if (rectify && pdfToMd) {
    throw new Error('Cannot use --rectify and --pdf-to-md flags together');
  }

  // Require target language for translation mode (not rectify or pdf-to-md)
  const isTranslationMode = !rectify && !pdfToMd;
  if (isTranslationMode && !targetLanguage) {
    throw new Error(
      'Target language is required. Use --to <language> to specify.\n' +
      'Examples:\n' +
      '  --to "Japanese"\n' +
      '  --to "formal German"\n' +
      '  --to "conversational Spanish"'
    );
  }

  const result = {
    inputFile,
    outputDir,
    chunkSize,
    model,
    reasoningEffort,
    rectify,
    pdfToMd,
    contextAware
  };

  if (targetLanguage) {
    result.targetLanguage = targetLanguage;
  }

  return result;
}
