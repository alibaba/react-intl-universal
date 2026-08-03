const fs = require('fs');
const pathtool = require('path');
const config = require('../../config');
const chalk = require('chalk');
const _ = require('lodash');
const { DETECT_REGEXP, NO_DEFAULT_REGEXP, MESSAGE_ERROR_CODE } = require('./constant');


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
 * @param scanRoot root used to evaluate relative ignore patterns
 * @returns {{key: string, originalDefaultMessage: string, transformedDefaultMessage: string}[]}
 */
function scanFiles(dirPath, options, ig, scanRoot = dirPath) {
  const files = fs.readdirSync(dirPath);
  let messages = [];
  for (let i = 0, len = files.length; i < len; i += 1) {
    const file = files[i];
    const filePath = pathtool.join(dirPath, file);
    const fileStat = fs.lstatSync(filePath);
    const relativePath = pathtool.relative(scanRoot, filePath).split(pathtool.sep).join('/');
    const ignorePath = fileStat.isDirectory() ? `${relativePath}/` : relativePath;
    if (ig && (ig.ignores(relativePath) || ig.ignores(ignorePath))) {
      continue;
    }

    const fileExtName = pathtool.extname(filePath);
    if (fileStat.isDirectory()) {
      messages = messages.concat(scanFiles(filePath, options, ig, scanRoot));
    } else if (options.extensions.includes(fileExtName)) {
      messages = messages.concat(processFile(filePath));
    }
  }
  return messages;
}

/**
 * Start to extract a file.
 * @param {string} path
 */
function processFile(path) {
  logger.log('Processing file: ', path);
  const content = fs.readFileSync(path, 'utf-8').toString();
  const invalidMessages = getNoDefaultMessages(content, path);
  const messages = extractMessages(content, path).concat(invalidMessages);
  messages.forEach((message) => logger.log(` - key="${message.key}" originalDefaultMessage="${message.originalDefaultMessage}" transformedDefaultMessage="${message.transformedDefaultMessage}"`));
  return messages;
}

/**
 * Resolve the one-based source line for a regular-expression match.
 * @param {string} content file content
 * @param {number} index match character index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Add source location metadata to an extracted message.
 * @param {object} message extracted message fields
 * @param {string} content source file content
 * @param {number} index match character index
 */
function addSourceMetadata(message, content, index) {
  const line = getLineNumber(content, index);
  return _.assign({}, message, { line });
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
    _messages.push(addSourceMetadata({
      key,
      path,
      originalDefaultMessage: defaultMessage,
      transformedDefaultMessage: transformDefaultMessage(defaultMessage, shouldTrim),
    }, content, match.index));
  }
  return _messages;
}

/**
 * Format a source path and optional line for diagnostics.
 * @param {object} message extracted message
 */
function formatMessageLocation(message) {
  const relativePath = pathtool.relative(process.cwd(), message.path || '').split(pathtool.sep).join('/');
  const displayPath = relativePath || message.path || '<unknown>';
  return message.line ? `${displayPath}:${message.line}` : displayPath;
}

/**
 * Collect de-duplicated validation issues from extracted messages.
 * @param {object[]} messages extracted messages
 */
function collectMessageIssues(messages) {
  const issues = [];
  const seenMissingDefaults = new Set();
  const messagesByKey = _.groupBy(messages, 'key');

  messages.forEach((message) => {
    if (message.isValid !== false || message.invalidType !== 'no_default') {
      return;
    }
    const identity = `${message.key}|${message.path}|${message.line || ''}`;
    if (seenMissingDefaults.has(identity)) {
      return;
    }
    seenMissingDefaults.add(identity);
    issues.push({
      code: MESSAGE_ERROR_CODE.NO_DEFAULT_MESSAGE,
      key: message.key,
      path: message.path,
      line: message.line,
    });
  });

  Object.keys(messagesByKey).sort().forEach((key) => {
    const occurrences = messagesByKey[key]
      .filter((message) => message.originalDefaultMessage != null)
      .map((message) => ({
        value: message.originalDefaultMessage,
        path: message.path,
        line: message.line,
      }));
    if (_.uniq(occurrences.map((item) => item.value)).length <= 1) {
      return;
    }
    issues.push({
      code: MESSAGE_ERROR_CODE.DEFAULT_MESSAGE_CONFLICT,
      key,
      occurrences: _.uniqBy(occurrences, (item) => `${item.value}|${item.path}|${item.line || ''}`),
    });
  });

  return issues;
}

/**
 * Format one structured validation issue as terminal output lines.
 * @param {object} issue validation issue
 */
function formatMessageIssueLines(issue) {
  if (issue.code === MESSAGE_ERROR_CODE.NO_DEFAULT_MESSAGE) {
    return [`Missing default message for key=${JSON.stringify(issue.key)} - ${formatMessageLocation(issue)}`];
  }

  return issue.occurrences.map((item) => (
    `Conflicting default message for key=${JSON.stringify(issue.key)}: ${JSON.stringify(item.value)} - ${formatMessageLocation(item)}`
  ));
}

/**
 * Verify messages and return both status and structured issues.
 * @param {object[]} messages extracted messages
 */
function verifyMessageResult(messages) {
  const issues = collectMessageIssues(messages);
  issues.forEach((issue) => {
    formatMessageIssueLines(issue).forEach((line) => logger.error(`❌ ${line}`));
  });

  if (issues.length === 0) {
    logger.success(`Validation passed: ${messages.length} messages are valid.`);
  } else {
    logger.error(`Validation failed: ${issues.length} problem${issues.length === 1 ? '' : 's'} found.`);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
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
  return verifyMessageResult(messages).ok;
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
    _messages.push(addSourceMetadata({
      key,
      path: filePath,
      isValid: false,
      invalidType: 'no_default',
    }, content, match.index));
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
    console.log(chalk.green(...arg));
  },
  info: (...arg) => {
    console.log(chalk.cyan(...arg));
  },
  error: (...arg) => {
    console.error(chalk.red(...arg));
  },
  warning: (...arg) => {
    console.warn(chalk.yellow(...arg));
  },
}

module.exports = {
  processParameters,
  scanFiles,
  extractMessages,
  verifyMessages,
  verifyMessageResult,
  collectMessageIssues,
  getNoDefaultMessages,
  logger,
};
