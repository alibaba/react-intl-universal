const fs = require('fs');
const pathTool = require('path');
const _ = require('lodash');
const ignore = require('ignore');
const { processParameters, scanFiles, verifyMessages, logger } = require('../util/util');
const cwd = process.cwd();
let ignoreFiles;

/**
 * Extract default message in directory.
 * @param {string} options.path directory path
 */
const extract = (options = {}) => {
  const params = processParameters('extract', options);
  ignoreFiles = ignore().add(_.get(params, 'ignore', []));
  const startPath = pathTool.join(cwd, params.sourcePath);
  logger.info('Start to extract.');
  let messages = scanFiles(startPath, params, ignoreFiles);
  messages = _.sortBy(messages, 'key');
  if (verifyMessages(messages)) {
    if (params.outputPath) {
      const outputPath = pathTool.join(cwd, params.outputPath);
      writeFile(messages, outputPath);
    }
    return messages;
  } else {
    logger.error('In order to continute to process file, please resolve the problems above first');
  }
  return [];
};

/**
 * Write the locale file
 * @param {{key: string, originalDefaultMessage: string, transformedDefaultMessage: string}[]} messages 
 * @param {string} filePath  
 */
function writeFile(messages, filePath) {
  logger.info('Writing file:', filePath);
  try {
    const directoryPath = pathTool.dirname(filePath);
    const sourceObj = {};
    (messages || []).forEach(item => {
      sourceObj[item.key] = item.transformedDefaultMessage;
    });
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(sourceObj, null, 2));
  } catch (error) {
    logger.error('Failed to write file', error.toString());
  }
  logger.success('Successd to write file.');
}

module.exports = {
  extract,
};
