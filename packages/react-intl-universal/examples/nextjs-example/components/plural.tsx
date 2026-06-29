import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';
import {
  renderCode,
  renderIcuMessageFormatLink,
} from 'components/format-doc-links';

const PluralComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_PLURAL').d('Plural messages')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_PLURAL', {
          code: renderCode,
          icu: renderIcuMessageFormatLink,
        }).d('Plural messages use ICU <code>plural</code> rules. The <code>#</code> placeholder is formatted with the active locale, so large numbers get locale-aware separators. Learn more in the <icu>ICU MessageFormat guide</icu>.')}
      </p>
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 0 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 1 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 1000000 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
    </div>
  );
}

export default PluralComponent;
