/**
 * Extractor
 */

const fs = require('fs');
const pathTool = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const ignore = require('ignore');
const { processParameters, scanFiles, verifyMessages } = require('../core/util');
const cwd = process.cwd();

let ig;

/**
 * Extract message from files in path
 * @param {{ bucId, appName, path, targetExtensions,  excludeDirName }} options
 */
const extractToDetailArray = (options = {}) => {
  const params = processParameters('common', options);
  ig = ignore().add(_.get(params, 'ignore', []));
  const startPath = pathTool.join(cwd, params.path);
  // console.log(chalk.magenta(`================== Scaning ==================`));
  let messages = scanFiles(startPath, params, ig);

  if (verifyMessages(messages)) {
    // const exportPath = pathTool.join(cwd, _.get(params, 'exportPath', './'));
    messages = _.sortBy(messages, 'key');
    messages = _.uniqBy(messages, 'key');
    return messages;
  } else {
    console.error(chalk.red('Some key has different default message. Please fix them.'))
    return null;
  }

};


/**
 * Exreact as simple map
 * options = {}
 * @param {{key: string, sourceDefaultMessage: string, targetDefaultMessage: string}[]} messages 
 */
function extractToSimpleMap(options = {}) {
  const messages = extractToDetailArray(options);
  const map = {};
  (messages || []).forEach(item => {
    map[item.key] = item.targetDefaultMessage;
  });
  return map;
}



module.exports = {
  extractToDetailArray,
  extractToSimpleMap
};
