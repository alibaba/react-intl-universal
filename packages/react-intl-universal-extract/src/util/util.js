const fs = require('fs');
const pathtool = require('path');
const config = require('../../config');
const chalk = require('chalk');
const _ = require('lodash');
const { DETECT_REGEXP, NO_DEFAULT_REGEXP } = require('./constant');


/**
 * Merge with default parameters
 * @param {string} command
 * @param {object} params
 */
function processParameters(command, params) {
  const commonConfig = _.get(config, 'common', {});
  const commandConfig = _.get(config, command, {});
  const processedParams = {};
  Object.keys(params).forEach(key => {
    let value;
    try {
      value = JSON.parse(params[key]);
    } catch (e) {
      value = params[key];
      if (typeof value === 'string' && /^\w+,/.test(value)) {
        value = value.split(',').map(item => item.trim());
      }
    }
    processedParams[key] = value;
  });

  const mergedParams = _.assign({}, commonConfig, commandConfig, processedParams);
  logger.verbose = mergedParams.verbose;
  return mergedParams;
}

/**
 * Scan files and extract message
 * @param dirPath Directory path
 * @param options.extensions File extensions ////
 * @param ig ignore files
 * @returns {{key: string, originalDefaultMessage: string, transformedDefaultMessage: string}[]}
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
 * Start to extract a file.
 * @param {string} path
 */
function processFile(path) {
  logger.info('Processing file: ', path)
  const content = fs.readFileSync(path, 'utf-8').toString();
  const invalidMessages = getNoDefaultMessages(content, path);
  const messages = extractMessages(content, path).concat(invalidMessages);
  messages.forEach((message) => logger.log(` - key="${message.key}" originalDefaultMessage="${message.originalDefaultMessage}" transformedDefaultMessage="${message.transformedDefaultMessage}"`));
  return messages;
}

/**
 * Given file content, extract the i18n message
 * @param {string} content file content
 * @return {array} list of {key, originalDefaultMessage, transformedDefaultMessage}
 */
function extractMessages(content, path) {
  const _messages = [];
  let match;
  while ((match = DETECT_REGEXP.exec(content)) != null) {
    const keyIndex = match[3] ? 3 : 6;
    const messageIndex = match[5] ? 5 : 8;
    let key = match[keyIndex];
    let defaultMessage = match[messageIndex];

    // Trim "${variable}" to "{variable}"
    const shouldTrim = /\.(d|defaultMessage)\([\s\S]*`[\s\S]*\)/.test(match[0]);
    _messages.push({
      key,
      path,
      originalDefaultMessage: defaultMessage,
      transformedDefaultMessage: transformDefaultMessage(defaultMessage, shouldTrim),
    });
  }
  return _messages;
}

/**
 *  Check if message is valid.
 * @param {{
 *  key: string,
 *  originalDefaultMessage: string,
 *  transformedDefaultMessage: string,
 *  isValid: boolean,
 *  invalidType: string,
 *  path: string,
 * }[]} messages
 */
function verifyMessages(messages) {
  logger.info('Start to verify messages...');

  let isOK = true;
  for (let i = 0, len = messages.length; i < len; ++i) {
    let currentMessage = messages[i];
    if (currentMessage.isValid === false && currentMessage.invalidType == 'no_default') {
      isOK = false;
      logger.error(`The key="${currentMessage.key}" has no default message ${currentMessage.path}`);
      continue;
    }
    const duplicate = _.find(messages, (message) => (currentMessage.key === message.key && currentMessage.originalDefaultMessage != null && message.originalDefaultMessage != null && currentMessage.originalDefaultMessage !== message.originalDefaultMessage));
    if (duplicate) {
      isOK = false;
      logger.error(`The key="${currentMessage.key}" has different default message "${currentMessage.originalDefaultMessage}" - ${currentMessage.path}`);
    }
  }
  if (isOK) {
    logger.success('All messages are valid.');
  } else {
    logger.error('Some messages are invalid.');
  }

  return isOK;
}

/**
 * Given file content, get intl object has no default message.
 * @param {string} content file content
 * @param {string} filePath file path
 */
function getNoDefaultMessages(content, filePath) {
  const _messages = [];
  let match;
  while ((match = NO_DEFAULT_REGEXP.exec(content)) != null) {
    let key = match[2];
    _messages.push({
      key,
      path: filePath,
      isValid: false,
      invalidType: 'no_default',
    });
  }
  return _messages;
}

/**
 * Transform variables in source defaultMessage (such as ES6 template strings) to target defaultMessage (such as ICU format)
 * Example: 'Hello, ${name}. Welcome to ${where}!' -> 'Hello, {name}. Welcome to {where}!'
 * @param {string} message source defaultMessage
 * @return {string} target defaultMessage (for translator)
*/
function transformDefaultMessage(message, shouldTrim) {
  if (!shouldTrim) {
    return message;
  }
  var reg = /\${[a-zA-Z0-9_\s\t]+}/gm;
  var match;
  while ((match = reg.exec(message)) != null) {
    message = message.replace(match[0], match[0].substr(1));
  }
  return message;
}

const logger = {
  verbose: false,
  log: (...arg) => {
    if (logger.verbose) {
      console.log(...arg);
    }
  },
  success: (...arg) => {
    if (logger.verbose) {
      console.log(chalk.green(...arg));
    }
  },
  info: (...arg) => {
    if (logger.verbose) {
      console.log(chalk.cyan(...arg));
    }
  },
  error: (...arg) => {
    console.log(chalk.red(...arg));
  },
  warning: (...arg) => {
    console.log(chalk.yellow(...arg));
  },
}

module.exports = {
  processParameters,
  scanFiles,
  verifyMessages,
  getNoDefaultMessages,
  logger,
};
