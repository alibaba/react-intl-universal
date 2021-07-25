const fs = require('fs');
const pathTool = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const ignore = require('ignore');
const { processParameters, scanFiles, verifyMessages } = require('../util/util');
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
  // console.log(chalk.magenta(`================== Start to scan ==================`));
  let messages = scanFiles(startPath, params, ignoreFiles);
  messages = _.sortBy(messages, 'key');
  if (verifyMessages(messages)) {
    if (params.outputPath) {
      const outputPath = pathTool.join(cwd, params.outputPath);
      writeFile(messages, outputPath);
    }
    return messages;
  } else {
    console.error(chalk.red('In order to continute to process file, please resolve the problems above first'))
  }
  return [];
};

/**
 * Write the locale file
 * @param {{key: string, originalDefaultMessage: string, transformedDefaultMessage: string}[]} messages 
 * @param {string} filePath  
 */
function writeFile(messages, filePath) {
  const directoryPath = pathTool.dirname(filePath);
  const sourceObj = {};
  (messages || []).forEach(item => {
    sourceObj[item.key] = item.transformedDefaultMessage;
  });
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(sourceObj, null, 2));
}

module.exports = {
  extract,
};
