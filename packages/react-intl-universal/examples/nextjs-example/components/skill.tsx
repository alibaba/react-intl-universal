import React from 'react';
import intl from 'core/intl';

const SkillComponent: React.FC = () => {
  const skillPath = 'https://github.com/alibaba/react-intl-universal/tree/master/skills/use-react-intl-universal';
  const skillLink = (chunks: React.ReactNode) => (
    <a href={skillPath} target="_blank" rel="noreferrer">
      {chunks}
    </a>
  );
  const installCommand = `npx skills add alibaba/react-intl-universal -y`;
  const projectGuidance = `${intl.get('EXAMPLE_SKILL_PROJECT_GUIDANCE').d('When working on internationalization with react-intl-universal, follow the use-react-intl-universal skill guidance.')}`;
  const agentPrompt = intl.get('EXAMPLE_SKILL_AGENT_PROMPT').d('Add a welcome message with username variable.');
  const inspectionPrompt = intl.get('EXAMPLE_SKILL_INSPECTION_PROMPT').d('Inspect https://example.com/settings in German and report localized UI issues with screenshots.');
  const inspectionReport = intl.get('EXAMPLE_SKILL_INSPECTION_REPORT').d('The agent clicks through safe interactions, handles dialogs, captures screenshots, and writes a report with the full inspection process and all findings.');
  const expectedCode = `<div>
  {intl
    .get('WELCOME_USER', { username })
    .d('Welcome, {username}!')}
</div>`;

  return (
    <div>
      <p className="section-note section-note-success">
        {intl.get('EXAMPLE_NOTE_SKILL', {
          skill: skillLink,
        }).d('Use the <skill>use-react-intl-universal</skill> skill to give agents a practical i18n workflow, not just API hints. It helps agents write natural localized copy, keep terminology consistent, avoid UI truncation, overflow, overlap, or misalignment, and inspect running pages with screenshots and findings reports.')}
      </p>

      <div className="example-comparison skill-comparison">
        <div className="example-panel">
          <div className="example-label">Install skill</div>
          <pre className="skill-prompt">{installCommand}</pre>
        </div>
        <div className="example-panel">
          <div className="example-label">Edit AGENTS.md or CLAUDE.md</div>
          <pre className="skill-prompt">{projectGuidance}</pre>
        </div>
      </div>

      <div className="example-comparison skill-agent-example">
        <div className="example-panel">
          <div className="example-label">Daily development prompt</div>
          <pre className="skill-prompt">{agentPrompt}</pre>
        </div>
        <div className="example-panel">
          <div className="example-label">Agent writes code</div>
          <pre className="skill-prompt">{expectedCode}</pre>
        </div>
      </div>

      <div className="example-comparison skill-agent-example">
        <div className="example-panel">
          <div className="example-label">UI inspection prompt</div>
          <pre className="skill-prompt">{inspectionPrompt}</pre>
        </div>
        <div className="example-panel">
          <div className="example-label">Inspection report</div>
          <pre className="skill-prompt">{inspectionReport}</pre>
        </div>
      </div>
    </div>
  );
};

export default SkillComponent;
