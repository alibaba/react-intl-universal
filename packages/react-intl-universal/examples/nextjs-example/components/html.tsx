import React, { useEffect, useState } from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';

interface BadgeProps {
  tone: 'red' | 'green';
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ tone, children }) => (
  <span className={`status-badge status-badge-${tone}`}>
    {children}
  </span>
);

const PackageLink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <a href="https://www.npmjs.com/package/react-intl-universal" target="_blank" rel="noreferrer">
    {children}
  </a>
);

const HtmlComponent: React.FC<any> = () => {
  const [showAllGetHTMLExamples, setShowAllGetHTMLExamples] = useState(false);
  const packageLink = (chunks: React.ReactNode) => <PackageLink>{chunks}</PackageLink>;
  const inlineCode = (chunks: React.ReactNode) => <code>{chunks}</code>;
  const richLinkCode = `<div>
  {intl.get('RICH_LINK', {
    // chunks is ["documentation"] here.
    link: chunks => (
      <a href="https://github.com/alibaba/react-intl-universal" target="_blank" rel="noreferrer">
        {chunks}
      </a>
    ),
  }).d('Please read the <link>documentation</link> for more details.')}
</div>`;
  const richMultipleChunksCode = `<div>
  {intl.get('RICH_MULTIPLE_CHUNKS', {
    username: 'Mia',
    service: 'Wi-Fi',
    // chunks is ["Mia"] here.
    user: chunks => <strong>{chunks}</strong>,
    // chunks is ["delayed"] here.
    status: chunks => <Badge tone="red">{chunks}</Badge>,
    // chunks is ["free ", "Wi-Fi"] here.
    gift: chunks => <Badge tone="green">{chunks}</Badge>,
  }).d('<user>{username}</user> has a <status>delayed</status> flight but got <gift>free {service}</gift>.')}
</div>`;
  const legacyLinkWorkaroundCode = `<div>
  {/* This split-and-concatenate pattern is not recommended. */}
  {intl.getHTML('LEGACY_LINK_BEFORE').d('Please read ')}
  <a href="https://github.com/alibaba/react-intl-universal" target="_blank" rel="noreferrer">
    {intl.get('LEGACY_LINK_TEXT').d('documentation')}
  </a>
  {intl.getHTML('LEGACY_LINK_AFTER').d(' for more details.')}
</div>`;
  const legacyBadgeWorkaroundCode = `<div>
  {/* This split-and-concatenate pattern is not recommended. */}
  {intl.getHTML('LEGACY_BADGE_BEFORE', {
    username: 'Mia',
  }).d('<strong>{username}</strong> has a ')}
  <Badge tone="red">{intl.get('LEGACY_BADGE_STATUS').d('delayed')}</Badge>
  {intl.getHTML('LEGACY_BADGE_BETWEEN').d(' flight but got ')}
  <Badge tone="green">
    {intl.get('LEGACY_BADGE_GIFT', { service: 'Wi-Fi' }).d('free {service}')}
  </Badge>
  {intl.getHTML('LEGACY_BADGE_AFTER').d('.')}
</div>`;
  const htmlTipCode = `<div>
  {intl.getHTML('TIP').d(
    <span>This is <span style={{ color: 'red' }}>HTML</span></span>
  )}
</div>`;
  const htmlTipWithVariableCode = `<div>
  {intl.getHTML('TIP_VAR', { message: 'HTML with variables' }).d(
    <span>This is <span style={{ color: 'red' }}>HTML with variables</span></span>
  )}
</div>`;
  const htmlTipWithEscapedVariableCode = `<div>
  {intl.getHTML('TIP_VAR', {
    message: '<script>alert("ReactIntlUniversal prevents from xss attack")</script>',
  }).d(
    <span>This is <span style={{ color: 'red' }}>HTML with escaped variables</span></span>
  )}
</div>`;

  useEffect(() => {
    const hostname = window.location.hostname;

    setShowAllGetHTMLExamples(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    );
  }, []);

  return (
    <div className="html-examples">
      <div className="title">{intl.get('EXAMPLE_TITLE_RICH_GET').d('Rich React components with intl.get')}</div>
      <p className="section-note section-note-success">
        {intl.get('EXAMPLE_NOTE_RICH_GET', {
          package: packageLink,
          code: inlineCode,
        }).d('Rich React components are supported in <package>react-intl-universal</package>@2.14+. Use <code>get</code> as the unified API for plain text, HTML-like markup, and React components.')}
      </p>
      <ExampleBlock code={richLinkCode} tone="rich" />
      <ExampleBlock code={richMultipleChunksCode} tone="rich" scope={{ Badge }} />

      <div className="title">{intl.get('EXAMPLE_TITLE_DEPRECATED_GETHTML').d('Deprecated rich text workaround with intl.getHTML')}</div>
      <p className="section-note section-note-warning">
        {intl.get('EXAMPLE_NOTE_DEPRECATED_GETHTML', {
          package: packageLink,
          code: inlineCode,
        }).d('intl.getHTML is deprecated. Use <code>get</code> as the unified API for messages. To render rich React components with <code>get</code>, upgrade to <package>react-intl-universal</package>@2.14+. The getHTML examples below split one sentence into several messages, which is harder to translate correctly.')}
      </p>
      {/* Keep the full deprecated getHTML comparison available on localhost,
          but show only one legacy example on the public demo. */}
      {showAllGetHTMLExamples && <ExampleBlock code={legacyLinkWorkaroundCode} tone="legacy" />}
      <ExampleBlock code={legacyBadgeWorkaroundCode} tone="legacy" scope={{ Badge }} />
      {showAllGetHTMLExamples && (
        <>
          <ExampleBlock code={htmlTipCode} tone="legacy" />
          <ExampleBlock code={htmlTipWithVariableCode} tone="legacy" />
          <ExampleBlock code={htmlTipWithEscapedVariableCode} tone="legacy" />
        </>
      )}
    </div>
  );
}

export default HtmlComponent;
