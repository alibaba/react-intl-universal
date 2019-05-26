import tool from "./index";
import _ from 'lodash';

const getSourceDefaultMessage = (result, key) => {
  return (_.find(result, { key }) || {}).sourceDefaultMessage;
}
const getTargetDefaultMessage = (result, key) => {
  return (_.find(result, { key }) || {}).targetDefaultMessage;
}

test("Test sync", () => {
  const result = tool.extractToDetailArray({
    path: './test-example',
  });
  const map = tool.extractToSimpleMap({
    path: './test-example',
  });

  console.log('map',map);

  expect(getSourceDefaultMessage(result, 'test0')).toBe('test(0) 中文0 ${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'test0_html')).toBe('<span>{`test(0) 中文0 ${HELLO_WORLD}`}</span>');
  expect(getSourceDefaultMessage(result, 'test1')).toBe('${HELLO_WORLD}中文1');
  expect(getSourceDefaultMessage(result, 'test2')).toBe('中文2${xxx}');
  expect(getSourceDefaultMessage(result, 'test3')).toBe('中文3');
  expect(getSourceDefaultMessage(result, 'test4')).toBe('中文44');
  expect(getSourceDefaultMessage(result, 'test5')).toBe('中文(5)');
  expect(getSourceDefaultMessage(result, 'test6')).toBe('中文6');
  expect(getSourceDefaultMessage(result, 'test10')).toBe('请输入"123"(数字)');
  expect(getSourceDefaultMessage(result, 'test11')).toBe('中文11${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'test12')).toBe('中文12${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'test13')).toBe('中文13${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'test14')).toBe('中文14${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'test15')).toBe('测试15(test)');

  expect(getSourceDefaultMessage(result, 'test-16-uuid-format')).toBe('测试16');
  expect(getSourceDefaultMessage(result, 'test17')).toBe('中文17${HELLO_WORLD}');
  expect(getSourceDefaultMessage(result, 'same-line1')).toBe('测试same line1');
  expect(getSourceDefaultMessage(result, 'same-line2')).toBe('测试same line2');
  expect(getSourceDefaultMessage(result, 'mutiple-line1')).toBe('测试mutiple-line1${HELLO_WORLD}${a}');
  expect(getSourceDefaultMessage(result, 'mutiple-line2')).toBe('测试mutiple-line2');

  expect(getSourceDefaultMessage(result, 'SALE_END')).toBe('拍卖将于${end}结束');
  expect(getTargetDefaultMessage(result, 'SALE_END')).toBe('拍卖将于{end}结束');
  expect(getSourceDefaultMessage(result, 'SALE_PRICE')).toBe('售价${price}');
  expect(getSourceDefaultMessage(result, 'SALE_START')).toBe('拍卖将于${start}开始');
  expect(getSourceDefaultMessage(result, 'SIMPLE')).toBe('this is default message');

  expect(getSourceDefaultMessage(result, 'HELLO')).toBe('Hello, ${name}. Welcome to ${where}!');
  expect(getTargetDefaultMessage(result, 'HELLO')).toBe('Hello, {name}. Welcome to {where}!');
  expect(getSourceDefaultMessage(result, 'HTML1')).toBe('<span>Tip 1</span>');
  expect(getSourceDefaultMessage(result, 'HTML2')).toBe('<span>(Tip 2)</span>');
  expect(getSourceDefaultMessage(result, 'HTML4')).toBe('<b>Hello</b>');
  expect(getSourceDefaultMessage(result, 'HTML5')).toBe('<div><span>he(l)lo</span><img src=\"https://www.npmjs.com/package/react-intl-universal\" /></div>');
  expect(getSourceDefaultMessage(result, 'HTML-same-line1')).toBe('<span>same 1</span>');
  expect(getSourceDefaultMessage(result, 'HTML-same-line2')).toBe('<span>same 2</span>');
  expect(getSourceDefaultMessage(result, 'HTML-vairable')).toBe('<b>Hello, {abc}</b>');
  expect(getSourceDefaultMessage(result, 'HTML0-uuid-format')).toBe('<span>Tip 0</span>');
  expect(getSourceDefaultMessage(result, 'switch_case_exporession_tips')).toBe('条件表达式示例：${exp}>支持的操作符: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%');

});



