import React from 'react';
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';

const SkillComponent: React.FC = () => {
  const skillLink = (chunks: React.ReactNode) => (
    <a href="https://github.com/alibaba/react-intl-universal/tree/master/skills/use-react-intl-universal" target="_blank" rel="noreferrer">
      {chunks}
    </a>
  );
  const inlineCode = (chunks: React.ReactNode) => <code>{chunks}</code>;
  const skillExampleCode = `<div>
  {intl.get('SKILL_DOCS_EXAMPLE', {
    username: 'Tony',
    link: chunks => (
      <a href="https://github.com/alibaba/react-intl-universal" target="_blank" rel="noreferrer">
        {chunks}
      </a>
    ),
  }).d('Hello, {username}. Read the <link>documentation</link>.')}
</div>`;

  return (
    <div>
      <p className="section-note section-note-success">
        {intl.get('EXAMPLE_NOTE_SKILL', {
          code: inlineCode,
          skill: skillLink,
        }).d('Start an AI coding request with <code>$use-react-intl-universal</code> when adding, reviewing, or migrating i18n code. The <skill>use-react-intl-universal skill</skill> helps keep messages extractable, grammatical, and consistent across locale files.')}
      </p>

      <div className="example-comparison skill-comparison">
        <div className="example-panel">
          <div className="example-label">Agent prompt</div>
          <pre className="skill-prompt">{`Use $use-react-intl-universal.

Add a localized message:
"Hello, Tony. Read the documentation."

Requirements:
- username is a variable
- documentation should render as a React link`}</pre>
        </div>
        <div className="example-panel">
          <div className="example-label">What the skill helps enforce</div>
          <ul className="skill-points">
            <li>Use <code>intl.get(...).d(...)</code> as the default API.</li>
            <li>Keep <code>.d(...)</code> as the source for extraction.</li>
            <li>Keep one complete sentence in the default message.</li>
            <li>Use ICU variables like <code>{'{username}'}</code>.</li>
            <li>Use rich tags like <code>{'<link>...</link>'}</code> for React elements.</li>
            <li>Keep component props such as <code>href</code> in code.</li>
          </ul>
        </div>
      </div>

      <ExampleBlock code={skillExampleCode} tone="rich" />
    </div>
  );
};

export default SkillComponent;
