import React from 'react';

const createExternalLink = (href: string) => (chunks: React.ReactNode) => (
  <a href={href} target="_blank" rel="noreferrer">
    {chunks}
  </a>
);

export const renderCode = (chunks: React.ReactNode) => <code>{chunks}</code>;

export const renderIcuMessageFormatLink = createExternalLink(
  'https://unicode-org.github.io/icu/userguide/format_parse/messages/'
);

export const renderFormatJsIcuSyntaxLink = createExternalLink(
  'https://formatjs.github.io/docs/core-concepts/icu-syntax/'
);

export const renderIntlMessageFormatLink = createExternalLink(
  'https://formatjs.github.io/docs/intl-messageformat/'
);

export const renderIntlNumberFormatLink = createExternalLink(
  'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat'
);
