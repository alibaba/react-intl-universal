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

  expect(getOriginal(result, 'basic1')).toBe('basic1');
  expect(getTransformed(result, 'basic1')).toBe('basic1');
});



