const fs = require('fs');
const pathtool = require('path');
const config = require('./config');
const chalk = require('chalk');
const _ = require('lodash');
const { DETECT_REGEXP } = require('./constants');


/**
 * Merge parameter with default one
 * @param {string} command
 * @param {object} params
 */
function processParameters(command, params) {
  // common config
  const commonConfig = _.get(config, 'common', {});
  // command specific config
  const commandConfig = _.get(config, command, {});

  // Process array, object parameters
  const processedParams = {};
  Object.keys(params).forEach(key => {
    let value;
    try {
      value = JSON.parse(params[key]);
    } catch (e) {
      value = params[key];
    }
    processedParams[key] = value;
  });

  return _.assign({}, commonConfig, commandConfig, processedParams);
}

/**
 * Ssan and extract files
 * @param {string} dirPath
 * @param {{ bucId, appName, path, extensions }} options
 * @param {} ig ignore files
 * @returns {{key: string, sourceDefaultMessage: string, targetDefaultMessage: string}[]}
 */
function scanFiles(dirPath, options, ig) {
  const files = fs.readdirSync(dirPath);
  let messages = [];
  for (let i = 0, len = files.length; i < len; i += 1) {
    const file = files[i];
    if (ig && !ig.ignores(file)) {
      const filePath = pathtool.join(dirPath, file);
      const fileExtName = pathtool.extname(filePath);
      const fileStat = fs.lstatSync(filePath);
      if (fileStat.isDirectory()) {
        messages = messages.concat(scanFiles(filePath, options, ig));
      } else if (options.extensions.includes(fileExtName)) {
        messages = messages.concat(processFile(filePath));
      }
    }
  }
  return messages;
}

/**
 * Get the extracted message list
 * @param {string} path
 */
function processFile(path) {
  // console.log(chalk.cyan('Processing file:', path));
  const content = fs.readFileSync(path, 'utf-8').toString();
  const messages = extractMessages(content);
  // messages.forEach((message) => console.log(` - key="${message.key}" sourceDefaultMessage="${message.sourceDefaultMessage}" targetDefaultMessage="${message.targetDefaultMessage}"`));
  return messages.map((message) => (Object.assign(message, { path })));
}

/**
 * Given file, extract the i18n message
 * @param {string} content file content
 * @return {array} list of {key, sourceDefaultMessage, targetDefaultMessage}
 */
function extractMessages(content) {
  const _messages = [];
  let match;
  while ((match = DETECT_REGEXP.exec(content)) != null) {
    const keyIndex = match[3] ? 3 : 6;
    const messageIndex = match[5] ? 5 : 8;
    let key = match[keyIndex];
    let defaultMessage = match[messageIndex];
    _messages.push({
      key,
      sourceDefaultMessage: defaultMessage,
      targetDefaultMessage: transformDefaultMessage(defaultMessage)
    })
  }
  return _messages;
}

/**
 * Check if the same key has the same message.
 * @param {{key: string, sourceDefaultMessage: string, targetDefaultMessage: string}[]} messages
 */
function verifyMessages(messages) {
  // console.log(chalk.magenta('================== Verying the result =================='));

  let isOK = true;
  for (let i = 0, len = messages.length; i < len; ++i) {
    let currentMessage = messages[i];
    // if (currentMessage.sourceDefaultMessage == null) {
    //   isOK = false;
    //   console.warn(`❌ key="${currentMessage.key}" has no default message - ${currentMessage.path}`);
    //   continue;
    // }
    const duplicate = _.find(messages, (message) => (currentMessage.key === message.key && currentMessage.sourceDefaultMessage != null && message.sourceDefaultMessage != null && currentMessage.sourceDefaultMessage !== message.sourceDefaultMessage));
    if (duplicate) {
      isOK = false;
      console.warn(`❌ key="${currentMessage.key}" has different default message: "${currentMessage.sourceDefaultMessage}" - ${currentMessage.path}`);
    }
  }
  return isOK;
}

/**
 * Transform variables in source defaultMessage (such as ES6 template strings) to target defaultMessage (such as ICU format)
 * Example: 'Hello, ${name}. Welcome to ${where}!' -> 'Hello, {name}. Welcome to {where}!'
 * @param {string} message source defaultMessage
 * @return {string} target defaultMessage (for translator)
*/
function transformDefaultMessage(message) {
  var reg = /\${[a-zA-Z0-9_\s\t]+}/gm;
  var match;
  while ((match = reg.exec(message)) != null) {
    message = message.replace(match[0], match[0].substr(1))
  }
  return message;
}

module.exports = {  processParameters, scanFiles, verifyMessages };
