import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import {
  renderCode,
  renderFormatJsIcuSyntaxLink,
} from 'components/format-doc-links';

const BasicComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_PLAIN').d('Plain string messages')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_PLAIN', {
          code: renderCode,
          formatjs: renderFormatJsIcuSyntaxLink,
        }).d('Use ICU variables with the values passed to <code>intl.get</code>. Keep <code>.d()</code> as the default message and source text for extraction. See <formatjs>FormatJS ICU syntax</formatjs> for details.')}
      </p>
      <ExampleBlock code={"<div>{intl.get('SIMPLE').d('Simple Sentence')}</div>"} />
      <ExampleBlock code={"<div>{intl.get('HELLO', { username: 'Tony' }).d('Hello, {username}!')}</div>"} />
    </div>
  );
}

export default BasicComponent;
