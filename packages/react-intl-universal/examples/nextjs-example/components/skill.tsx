import React from 'react';
import intl from 'core/intl';

const SkillComponent: React.FC = () => {
  const skillPath = 'https://github.com/alibaba/react-intl-universal/tree/master/skills/use-react-intl-universal';
  const mqmPath = 'https://www.w3.org/community/mqmcg';
  const workflowImageUrl = 'https://img.alicdn.com/imgextra/i1/O1CN01bMmYFt21ZbDPDQxJT_!!6000000006999-2-tps-1536-1024.png';
  const skillLink = (chunks: React.ReactNode) => (
    <a href={skillPath} target="_blank" rel="noreferrer">
      {chunks}
    </a>
  );
  const mqmLink = (chunks: React.ReactNode) => (
    <a href={mqmPath} target="_blank" rel="noreferrer">
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
  const skillBenefits = [
    intl.get('EXAMPLE_SKILL_BENEFIT_COPY').d('write high-quality localized copy that preserves the real product meaning, not word-for-word translations;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_TERMS').d('keep product terms and UI wording consistent across modules;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_UI').d('avoid broken localized UI, such as text truncation, overflow, overlap, or misalignment;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_CONTRACT').d('keep ICU variables, rich tags, default messages, and locale files aligned;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_MQM', {
      mqm: mqmLink,
    }).d('review translation quality with <mqm>Multidimensional Quality Metrics (MQM)</mqm>, one of the most professional and comprehensive translation quality assessment frameworks widely recognized in the localization industry;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_INSPECTION').d('inspect running localized pages by URL, click through interactions, capture screenshots, and generate a process-and-findings report;'),
    intl.get('EXAMPLE_SKILL_BENEFIT_REVIEWABLE').d('produce smaller, more reviewable locale changes.'),
  ];

  return (
    <div>
      <p className="section-note section-note-success">
        {intl.get('EXAMPLE_NOTE_SKILL', {
          skill: skillLink,
        }).d('Use the <skill>use-react-intl-universal</skill> skill to give agents a practical i18n workflow, not just API hints.')}
      </p>

      <a className="skill-workflow-image-link" href={skillPath} target="_blank" rel="noreferrer">
        <img
          className="skill-workflow-image"
          src={workflowImageUrl}
          alt="use-react-intl-universal Agent Skill workflow"
          loading="lazy"
        />
      </a>

      <div className="skill-benefits">
        <div className="example-label">{intl.get('EXAMPLE_SKILL_BENEFITS_TITLE').d('It helps agents:')}</div>
        <ul>
          {skillBenefits.map((benefit, index) => (
            <li key={index}>{benefit}</li>
          ))}
        </ul>
      </div>

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
          <div className="example-label">Case 1: Daily development prompt</div>
          <pre className="skill-prompt">{agentPrompt}</pre>
        </div>
        <div className="example-panel">
          <div className="example-label">Agent writes code</div>
          <pre className="skill-prompt">{expectedCode}</pre>
        </div>
      </div>

      <div className="example-comparison skill-agent-example">
        <div className="example-panel">
          <div className="example-label">Case 2: UI inspection prompt</div>
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
