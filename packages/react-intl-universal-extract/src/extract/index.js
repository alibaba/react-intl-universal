const fs = require('fs');
const pathTool = require('path');
const _ = require('lodash');
const ignore = require('ignore');
const { processParameters, scanFiles, verifyMessageResult, logger } = require('../util/util');
const { EXTRACT_ERROR_CODE } = require('../util/constant');
const cwd = process.cwd();

/**
 * Run extraction and return status details for the CLI.
 * @param {object} options extraction options
 */
const extractWithResult = (options = {}) => {
  const params = processParameters('extract', options);
  const startPath = pathTool.join(cwd, params.sourcePath);
  logger.info(`Extracting messages from ${params.sourcePath}`);

  let messages;
  try {
    const ignoreFiles = ignore().add(_.get(params, 'ignore', []));
    messages = scanFiles(startPath, params, ignoreFiles);
  } catch (error) {
    logger.error(`[${EXTRACT_ERROR_CODE.SOURCE_SCAN_FAILED}] Failed to scan ${params.sourcePath}: ${error.message}`);
    return {
      ok: false,
      errorCode: EXTRACT_ERROR_CODE.SOURCE_SCAN_FAILED,
      messages: [],
      issues: [],
      error,
    };
  }

  messages = _.sortBy(messages, 'key');
  logger.info(`Found ${messages.length} messages. Verifying...`);
  const validation = verifyMessageResult(messages);
  if (!validation.ok) {
    return {
      ok: false,
      errorCode: EXTRACT_ERROR_CODE.MESSAGE_VALIDATION_FAILED,
      messages: [],
      issues: validation.issues,
    };
  }

  if (params.outputPath) {
    const outputPath = pathTool.join(cwd, params.outputPath);
    try {
      writeFile(messages, outputPath);
    } catch (error) {
      logger.error(`[${EXTRACT_ERROR_CODE.OUTPUT_WRITE_FAILED}] Failed to write ${params.outputPath}: ${error.message}`);
      return {
        ok: false,
        errorCode: EXTRACT_ERROR_CODE.OUTPUT_WRITE_FAILED,
        messages,
        issues: [],
        error,
      };
    }
  }

  return {
    ok: true,
    errorCode: null,
    messages,
    issues: [],
  };
};

/**
 * Extract default messages while preserving the public array return value.
 * @param {object} options extraction options
 */
const extract = (options = {}) => {
  const result = extractWithResult(options);
  if (!result.ok && result.errorCode === EXTRACT_ERROR_CODE.SOURCE_SCAN_FAILED) {
    throw result.error;
  }
  return result.messages;
};

/**
 * Write the locale file
 * @param {{key: string, originalDefaultMessage: string, transformedDefaultMessage: string}[]} messages 
 * @param {string} filePath  
 */
function writeFile(messages, filePath) {
  logger.info(`Writing messages to ${filePath}`);
  const directoryPath = pathTool.dirname(filePath);
  const sourceObj = {};
  (messages || []).forEach(item => {
    sourceObj[item.key] = item.transformedDefaultMessage;
  });
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(sourceObj, null, 2));
  logger.success(`Wrote ${messages.length} messages to ${filePath}.`);
}

module.exports = {
  extract,
  extractWithResult,
  writeFile,
};
