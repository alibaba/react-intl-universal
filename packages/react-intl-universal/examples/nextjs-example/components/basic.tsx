import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';

const BasicComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_PLAIN').d('Plain string messages')}</div>
      <ExampleBlock code={"<div>{intl.get('SIMPLE').d('Simple Sentence')}</div>"} />
      <ExampleBlock code={"<div>{intl.get('HELLO', { username: 'Tony' }).d('Hello, {username}!')}</div>"} />
    </div>
  );
}

export default BasicComponent;
