import React from 'react'
import intl from 'core/intl';

const HtmlComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Html Examples:</div>
      <div>{intl.getHTML('TIP')}</div>
      <div>{intl.getHTML('TIP_VAR', { message: 'HTML with variables' })}</div>
      <div>{intl.getHTML('TIP_VAR', { message: '<script>alert("ReactIntlUniversal prevents from xss attack")</script>' })}</div>
    </div>
  );
}

export default HtmlComponent;