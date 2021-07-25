import script from "./index";
import _ from 'lodash';

const getOriginal = (result, key) => {
  return (_.find(result, { key }) || {}).originalDefaultMessage;
}

const getTransformed = (result, key) => {
  return (_.find(result, { key }) || {}).transformedDefaultMessage;
}

test("Test extract", () => {
  const result = script.extract({
    sourcePath: './test-files',
    outputPath: './locales/en_US.json',
    // verbose: true,
  });

  expect(getOriginal(result, 'basic1')).toBe('default message');
  expect(getTransformed(result, 'basic1')).toBe('default message');

  expect(getOriginal(result, 'basic2')).toBe('Default message for basic[2]');
  expect(getTransformed(result, 'basic2')).toBe('Default message for basic[2]');

  expect(getOriginal(result, 'basic3')).toBe('Default message for basic(3)');
  expect(getTransformed(result, 'basic3')).toBe('Default message for basic(3)');

  expect(getOriginal(result, 'basic4')).toBe('Default message for basic(4) with 中文');
  expect(getTransformed(result, 'basic4')).toBe('Default message for basic(4) with 中文');

  expect(getOriginal(result, 'basic5')).toBe('Default message for basic5 with 中文(5)');
  expect(getTransformed(result, 'basic5')).toBe('Default message for basic5 with 中文(5)');

  expect(getOriginal(result, 'basic6')).toBe('Default message for basic6 with "123(中文)"');
  expect(getTransformed(result, 'basic6')).toBe('Default message for basic6 with "123(中文)"');

  expect(getOriginal(result, 'character1')).toBe('Expression support: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%');
  expect(getTransformed(result, 'character1')).toBe('Expression support: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%');

  expect(getOriginal(result, 'html1')).toBe('<span>This is html</span>');
  expect(getTransformed(result, 'html1')).toBe('<span>This is html</span>');

  expect(getOriginal(result, 'html2')).toBe('<span>This is html</span>');
  expect(getTransformed(result, 'html2')).toBe('<span>This is html</span>');

  expect(getOriginal(result, 'html3')).toBe('<span>(This is html)</span>');
  expect(getTransformed(result, 'html3')).toBe('<span>(This is html)</span>');

  expect(getOriginal(result, 'html4')).toBe('<span>Hello4 {name}</span>');
  expect(getTransformed(result, 'html4')).toBe('<span>Hello4 {name}</span>');

  expect(getOriginal(result, 'html5')).toBe('<span>Hello5 {name}, welcome to <a href={webLink}>my website!</a></span>');
  expect(getTransformed(result, 'html5')).toBe('<span>Hello5 {name}, welcome to <a href={webLink}>my website!</a></span>');

  expect(getOriginal(result, 'html6')).toBe('<span>welcome to <a href="https://www.npmjs.com/package/react-intl-extract">my website</a></span>');
  expect(getTransformed(result, 'html6')).toBe('<span>welcome to <a href="https://www.npmjs.com/package/react-intl-extract">my website</a></span>');

  expect(getOriginal(result, 'html7')).toBe('<span>Hello7 {name}</span>');
  expect(getTransformed(result, 'html7')).toBe('<span>Hello7 {name}</span>');

  expect(getOriginal(result, 'html8')).toBe('<span>html8</span>');
  expect(getTransformed(result, 'html8')).toBe('<span>html8</span>');

  expect(getOriginal(result, 'html9')).toBe('<span>html9</span>');
  expect(getTransformed(result, 'html9')).toBe('<span>html9</span>');

  expect(getOriginal(result, 'newline1')).toBe('Default message for newline1');
  expect(getTransformed(result, 'newline1')).toBe('Default message for newline1');

  expect(getOriginal(result, 'newline2')).toBe('Default message for newline2');
  expect(getTransformed(result, 'newline2')).toBe('Default message for newline2');

  expect(getOriginal(result, 'newline3')).toBe('Default message for newline1');
  expect(getTransformed(result, 'newline3')).toBe('Default message for newline1');

  expect(getOriginal(result, 'newline4')).toBe('Default message for newline2');
  expect(getTransformed(result, 'newline4')).toBe('Default message for newline2');

  expect(getOriginal(result, 'same-same_line2')).toBe('Default message for same_line2');
  expect(getTransformed(result, 'same-same_line2')).toBe('Default message for same_line2');

  expect(getOriginal(result, 'same_line1')).toBe('Default message for same_line1');
  expect(getTransformed(result, 'same_line1')).toBe('Default message for same_line1');

  expect(getOriginal(result, 'var1')).toBe('Hello1, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var1')).toBe('Hello1, {name}. Welcome to {where}!');

  expect(getOriginal(result, 'var2')).toBe('你好2, ${name}. 欢迎来到 ${where}！');
  expect(getTransformed(result, 'var2')).toBe('你好2, {name}. 欢迎来到 {where}！');

  expect(getOriginal(result, 'var3')).toBe('Hello3, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var3')).toBe('Hello3, {name}. Welcome to {where}!');

  expect(getOriginal(result, 'var4')).toBe('你好4, ${name}. 欢迎来到 ${where}！');
  expect(getTransformed(result, 'var4')).toBe('你好4, {name}. 欢迎来到 {where}！');

  expect(getOriginal(result, 'var5')).toBe('Hello5, ${name}. Welcome to ${where}!');
  expect(getTransformed(result, 'var5')).toBe('Hello5, {name}. Welcome to {where}!');

});



