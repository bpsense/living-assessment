import type {
  AssignmentTemplateInsert,
  ProjectPhase,
  FinalProduct,
  ChoicePoint,
  DifferentiationGuide,
  TemplateResource,
} from '../types/database'

/**
 * Seed PBL project templates.
 *
 * competency_ids and skill_ids use placeholder UUIDs — replace with the
 * school's actual framework IDs at insert time.
 */

function uid(): string {
  return crypto.randomUUID()
}

// ============================================================
// 1. "Our Community Water Story"
// ============================================================

function waterStory(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Launch & Wonder',
      description: 'Entry event: walk around the school/neighborhood to observe water features. Introduce the driving question and spark curiosity.',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Water Walk', description: 'Walk around the school or neighborhood observing how water is used, stored, and transported. Sketch observations.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Clipboards', 'Observation journals'], educator_notes: 'Partner with custodial staff or a local water authority guide if possible.' },
        { id: uid(), title: 'Know/Need-to-Know Chart', description: 'Whole-group brainstorm: what do we know about water in our community? What do we need to find out?', activity_type: 'investigation', is_required: true, estimated_minutes: 30, resources: ['Chart paper'], educator_notes: 'Capture student questions verbatim — they drive the inquiry.' },
        { id: uid(), title: 'Water Use Survey', description: 'Students survey family members about water use at home. Record findings for class data set.', activity_type: 'investigation', is_required: false, estimated_minutes: 20, resources: ['Survey template'], educator_notes: 'Send home as homework; allow 2 days for completion.' },
      ],
      reflection_prompts: [
        'What surprised you about how water moves through our community?',
        'What question are you most curious about?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Investigate & Discover',
      description: 'Research water systems, test local water quality, interview community members and experts.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Water Quality Testing', description: 'Test samples from school fountains, local streams, or rain barrels for pH, turbidity, and dissolved solids.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Water test kits', 'Collection containers', 'Data recording sheets'], educator_notes: 'Review lab safety. Small groups of 3-4 students.' },
        { id: uid(), title: 'Expert Interview', description: 'Invite a water authority representative or environmental scientist for a Q&A session.', activity_type: 'field_work', is_required: true, estimated_minutes: 45, resources: [], educator_notes: 'Have students prepare questions in advance. Assign notetakers.' },
        { id: uid(), title: 'Research Reading Groups', description: 'Jigsaw reading on water cycle, water treatment, water conservation, and water justice.', activity_type: 'skill_building', is_required: true, estimated_minutes: 60, resources: ['Leveled reading packets', 'Graphic organizers'], educator_notes: 'Provide differentiated texts at varied reading levels.' },
      ],
      reflection_prompts: [
        'What data surprised you most? Why?',
        'How has your understanding of water in our community changed?',
      ],
      checkpoint: {
        title: 'Research Portfolio Check',
        description: 'Students present their data, sources, and key findings to the educator.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['At least 3 sources consulted', 'Data collected and organized', 'Key findings articulated clearly'],
      },
    },
    {
      id: p3Id,
      title: 'Create & Refine',
      description: 'Design an awareness campaign and draft a proposal for the city council.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Campaign Planning', description: 'Teams choose a water issue and design an awareness campaign: posters, social media posts, infographics, or PSA videos.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Art supplies', 'Laptops/tablets', 'Canva or poster templates'], educator_notes: 'Groups of 3-4. Encourage mixed media.' },
        { id: uid(), title: 'Draft Action Proposal', description: 'Write a proposal to the city council outlining the problem, evidence, and recommended actions.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Proposal template', 'Data from investigation phase'], educator_notes: 'Model a strong proposal structure before students draft.' },
        { id: uid(), title: 'Peer Critique Gallery', description: 'Gallery walk: teams post draft campaigns and proposals, peers leave structured feedback using "I notice / I wonder / What if" protocol.', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: ['Sticky notes', 'Feedback protocol sheet'], educator_notes: 'Teach the critique protocol explicitly before the gallery walk.' },
      ],
      reflection_prompts: [
        'What feedback was most helpful for improving your work?',
        'How does your campaign connect evidence to action?',
      ],
      checkpoint: {
        title: 'Peer Review',
        description: 'Structured peer feedback on campaign drafts and proposals.',
        assessment_type: 'peer_review',
        competency_ids: [],
        criteria: ['Campaign addresses a real water issue', 'Proposal uses evidence', 'Feedback from peers incorporated'],
      },
    },
    {
      id: p4Id,
      title: 'Present & Reflect',
      description: 'Community showcase: present campaigns and proposals to families, community members, and local officials.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Rehearsal', description: 'Practice presentations, refine visual displays, prepare speaking roles.', activity_type: 'presentation', is_required: true, estimated_minutes: 60, resources: [], educator_notes: 'Coach on eye contact, volume, and handling questions.' },
        { id: uid(), title: 'Community Showcase', description: 'Host a water showcase event. Students present campaigns and proposals to an authentic audience.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Display boards', 'Projection setup', 'Refreshments'], educator_notes: 'Invite families, water authority reps, school board members.' },
        { id: uid(), title: 'Self-Assessment & Celebration', description: 'Students complete self-assessment rubrics and write a reflection letter about their learning journey.', activity_type: 'reflection', is_required: true, estimated_minutes: 45, resources: ['Self-assessment rubric', 'Reflection letter template'], educator_notes: 'Frame self-assessment as growth, not grades.' },
      ],
      reflection_prompts: [
        'What am I most proud of in this project?',
        'What would I do differently next time?',
        'How did this project change the way I think about water?',
      ],
      checkpoint: {
        title: 'Final Self-Assessment',
        description: 'Students assess their own learning across all competencies.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Addressed driving question', 'Demonstrated growth in competencies', 'Reflected honestly on the process'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which water topic to investigate deeply (water cycle, treatment, conservation, or justice).', choice_type: 'topic_selection', options: ['Water cycle', 'Water treatment', 'Water conservation', 'Water justice'] },
    { phase_id: p3Id, description: 'Choose the format for the awareness campaign.', choice_type: 'product_format', options: ['Poster series', 'Infographic', 'PSA video', 'Social media campaign', 'Interactive display'] },
    { phase_id: p4Id, description: 'Choose presentation role and style.', choice_type: 'presentation_style', options: ['Lead presenter', 'Visual display manager', 'Q&A specialist', 'Demonstration leader'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A multimedia awareness campaign (posters, infographics, or PSA) paired with a written action proposal to the city council.',
    format_options: ['Poster series', 'Infographic', 'PSA video', 'Mixed media display'],
    audience: 'Families, community members, and local water authority representatives',
    presentation_format: 'Community showcase / gallery walk event',
    quality_criteria: [
      'Clearly communicates a water issue with supporting evidence',
      'Proposal includes problem statement, evidence, and actionable recommendations',
      'Campaign is visually engaging and appropriate for the target audience',
      'Presentation demonstrates understanding of the driving question',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Challenge students to research water issues in other communities or countries and draw comparisons. Invite them to write to an actual city council member.',
    supporting: 'Provide sentence starters for proposals, graphic organizers for research, and pre-selected reading materials at accessible levels. Pair students strategically.',
    ell_accommodations: 'Provide bilingual glossaries for water science terms. Allow presentations in the student\'s home language with English visual supports. Use visual-heavy research sources.',
    accessibility_notes: 'Offer alternative observation methods for the water walk (photos, audio recordings). Ensure all digital resources are screen-reader compatible. Provide large-print materials as needed.',
  }

  const resources: TemplateResource[] = [
    { title: 'Water Quality Test Kit Guide', type: 'printable', url: null, notes: 'Instructions for basic water testing suitable for elementary students.' },
    { title: 'EPA "Water Sense" for Kids', type: 'link', url: 'https://www.epa.gov/watersense', notes: 'Age-appropriate water conservation information from the EPA.' },
    { title: 'Proposal Writing Template', type: 'printable', url: null, notes: 'Scaffolded template: problem, evidence, recommendation, call to action.' },
    { title: 'I Notice / I Wonder Protocol', type: 'printable', url: null, notes: 'Structured peer feedback protocol for gallery walk critique.' },
    { title: 'A Cool Drink of Water (Barbara Kerley)', type: 'book', url: null, notes: 'Photo essay showing how people around the world access and use water.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Our Community Water Story',
    description: 'An interdisciplinary PBL project where students investigate their community\'s water system, test water quality, and create an awareness campaign with an action proposal for local leaders.',
    assignment_type: 'class',
    competency_ids: [], // Map to school's framework at insert time
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'elementary',
    subject_area: ['Science', 'ELA'],
    estimated_duration_days: 20,
    driving_question: 'How does water travel through our community, and what can we do to protect it?',
    essential_understandings: [
      'Water moves through natural and human-made systems that are interconnected.',
      'Human choices directly impact water quality and availability.',
      'Communities can take collective action to protect shared resources.',
    ],
    authenticity_hook: 'Partnership with the local water authority. Students present findings and proposals to actual community stakeholders at a public showcase event.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'I Notice / I Wonder / What If protocol during gallery walk. Each team receives feedback from at least 3 peer groups and must document how they incorporated the feedback in their revision.',
    scaffolding_notes: 'Front-load key vocabulary (watershed, turbidity, conservation, proposal). Use thinking routines (See-Think-Wonder) during the water walk. Provide data recording templates and proposal scaffolds.',
    differentiation,
    materials_and_resources: resources,
    tags: ['water', 'community', 'science', 'elementary', 'environmental'],
    status: 'published',
  }
}

// ============================================================
// 2. "Design a Fair Economy"
// ============================================================

function fairEconomy(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Launch & Simulate',
      description: 'Entry event: play an economic simulation game that reveals trade-offs between equality and growth. Introduce the driving question.',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Economy Simulation Game', description: 'Play a classroom simulation where students experience different economic roles and observe outcomes. Debrief on fairness vs. efficiency.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Simulation game materials', 'Role cards', 'Play money'], educator_notes: 'Assign roles randomly. Debrief immediately after — capture emotional reactions.' },
        { id: uid(), title: 'Economic Concepts Intro', description: 'Mini-lessons on GDP, inequality measures, taxation, and public goods using real-world data visualizations.', activity_type: 'skill_building', is_required: true, estimated_minutes: 60, resources: ['Data visualization handouts', 'Gapminder.org'], educator_notes: 'Keep concepts concrete with visual data. Avoid abstract definitions.' },
      ],
      reflection_prompts: [
        'What felt unfair in the simulation? What felt fair?',
        'Is it possible to have an economy that is both fair and prosperous?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Research & Analyze',
      description: 'Study real economic systems through case studies of different countries and their trade-offs.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Country Case Studies', description: 'In pairs, research how a specific country balances fairness and prosperity. Analyze data on income distribution, public services, and quality of life.', activity_type: 'investigation', is_required: true, estimated_minutes: 120, resources: ['Country data packets', 'CIA World Factbook', 'OECD Better Life Index'], educator_notes: 'Assign diverse countries: Sweden, Singapore, Brazil, Botswana, Japan, etc.' },
        { id: uid(), title: 'Expert Panel Discussion', description: 'Structured discussion where each pair presents their country\'s approach. Class identifies patterns and trade-offs.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Presentation guidelines', 'Note-taking template'], educator_notes: 'Model respectful disagreement. Encourage evidence-based arguments.' },
        { id: uid(), title: 'Math: Analyzing Inequality Data', description: 'Calculate and compare Gini coefficients, create income distribution graphs, and interpret statistical measures of inequality.', activity_type: 'skill_building', is_required: true, estimated_minutes: 60, resources: ['Spreadsheet templates', 'Graphing calculators'], educator_notes: 'Connect math skills to real-world application. Scaffold graphing as needed.' },
      ],
      reflection_prompts: [
        'Which country\'s economic approach surprised you most? Why?',
        'What trade-offs seem unavoidable in economic design?',
      ],
      checkpoint: {
        title: 'Case Study Review',
        description: 'Present case study findings to the educator with supporting data.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['At least 3 data sources cited', 'Trade-offs clearly identified', 'Comparison to other systems attempted'],
      },
    },
    {
      id: p3Id,
      title: 'Design & Model',
      description: 'Design an economic system for a fictional small country, including taxation, public services, and economic policies.',
      duration_days: 7,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Economic Policy Design', description: 'Teams design economic policies for their fictional country: tax structure, public spending priorities, trade policies, and social safety nets.', activity_type: 'creation', is_required: true, estimated_minutes: 150, resources: ['Policy design worksheet', 'Budget template'], educator_notes: 'Provide a fixed "national budget" to force real trade-offs. No unlimited spending.' },
        { id: uid(), title: 'Policy Brief Writing', description: 'Write a formal policy brief that explains and defends the team\'s economic design choices with data from their research.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Policy brief template', 'Research notes'], educator_notes: 'Model a strong policy brief. Emphasize evidence-based argumentation.' },
        { id: uid(), title: 'Peer Critique: Devil\'s Advocate', description: 'Teams exchange policy briefs. Each critiquing team must argue against the proposed system, identifying weaknesses and unintended consequences.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Critique protocol sheet'], educator_notes: 'Teach the difference between constructive criticism and personal attack.' },
      ],
      reflection_prompts: [
        'What was the hardest trade-off your team had to make?',
        'How did the Devil\'s Advocate feedback change your design?',
      ],
      checkpoint: {
        title: 'Peer Critique Exchange',
        description: 'Devil\'s Advocate critique of another team\'s economic design.',
        assessment_type: 'group_critique',
        competency_ids: [],
        criteria: ['Identified at least 2 strengths', 'Raised at least 2 substantive concerns', 'Feedback was specific and evidence-based'],
      },
    },
    {
      id: p4Id,
      title: 'Present & Defend',
      description: 'UN-style Economic Summit where teams present their economic designs to a panel of judges.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Summit Preparation', description: 'Finalize presentations, create visual aids, rehearse Q&A defense.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Presentation software', 'Visual aid materials'], educator_notes: 'Coach students on fielding tough questions. Role-play Q&A.' },
        { id: uid(), title: 'Economic Summit', description: 'Teams present their economic designs to a panel (teachers, parents, community members). Panel asks questions; teams defend their choices.', activity_type: 'presentation', is_required: true, estimated_minutes: 120, resources: ['Timer', 'Scoring rubrics for panelists', 'Name placards'], educator_notes: 'Invite diverse panelists. Brief them on the rubric and driving question.' },
        { id: uid(), title: 'Reflection Essay', description: 'Individual reflective essay: How did this project change your understanding of fairness and prosperity?', activity_type: 'reflection', is_required: true, estimated_minutes: 45, resources: ['Reflection prompt sheet'], educator_notes: 'This is individual, even though the project was team-based.' },
      ],
      reflection_prompts: [
        'What did you learn about the complexity of economic decision-making?',
        'If you could advise a real government, what would you tell them?',
        'How did working in a team help or challenge you?',
      ],
      checkpoint: {
        title: 'Summit Self-Assessment',
        description: 'Individual self-assessment of learning and collaboration.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Demonstrated understanding of economic trade-offs', 'Used evidence in argumentation', 'Reflected on personal growth'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which country to research as a case study.', choice_type: 'topic_selection', options: ['Sweden', 'Singapore', 'Brazil', 'Botswana', 'Japan', 'United States'] },
    { phase_id: p3Id, description: 'Choose economic priorities for the fictional country design.', choice_type: 'research_method', options: ['Equality-focused', 'Growth-focused', 'Sustainability-focused', 'Innovation-focused'] },
    { phase_id: p4Id, description: 'Choose presentation format for the summit.', choice_type: 'product_format', options: ['Slide presentation with live defense', 'Interactive poster with walkthrough', 'Video documentary with Q&A'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A comprehensive economic policy brief for a fictional country, paired with a formal presentation and defense at a UN-style Economic Summit.',
    format_options: ['Policy brief + slide presentation', 'Policy brief + poster walkthrough', 'Policy brief + video documentary'],
    audience: 'Panel of teachers, parents, and community members acting as international economic advisors',
    presentation_format: 'UN-style Economic Summit with formal presentation and Q&A defense',
    quality_criteria: [
      'Economic design addresses both fairness and prosperity with clear trade-off analysis',
      'Policy brief uses data from research phase to support recommendations',
      'Presentation is clear, organized, and professionally delivered',
      'Team effectively defends choices under questioning',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Challenge students to model their economy using a spreadsheet simulation. Have them write op-eds comparing their fictional system to a real country. Encourage them to research economic theories (Keynesian, supply-side, etc.) to inform their design.',
    supporting: 'Provide pre-organized country data packets. Offer policy design templates with guided questions. Allow presentations using visual displays rather than formal speeches. Pair strategically in teams.',
    ell_accommodations: 'Pre-teach economic vocabulary with visual glossary. Allow bilingual research sources. Provide sentence frames for the policy brief. Allow students to practice presentations in their home language first.',
    accessibility_notes: 'Provide digital versions of all materials. Allow alternative presentation formats (recorded video, written submission with visual display). Ensure simulation game is accessible to students with mobility limitations.',
  }

  const resources: TemplateResource[] = [
    { title: 'Gapminder', type: 'link', url: 'https://www.gapminder.org', notes: 'Interactive data visualization tool for comparing countries on economic and social indicators.' },
    { title: 'OECD Better Life Index', type: 'link', url: 'https://www.oecdbetterlifeindex.org', notes: 'Compare well-being across countries on 11 dimensions.' },
    { title: 'Policy Brief Template', type: 'printable', url: null, notes: 'Scaffolded template: executive summary, problem analysis, policy options, recommendations.' },
    { title: 'Understanding Economics (DK)', type: 'book', url: null, notes: 'Visual reference for core economic concepts accessible to middle schoolers.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Design a Fair Economy',
    description: 'Students research real-world economic systems, analyze trade-offs between equality and prosperity, and design their own economic policy for a fictional country — presenting at a UN-style summit.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'middle_school',
    subject_area: ['Math', 'Social Studies'],
    estimated_duration_days: 20,
    driving_question: 'If you could redesign the economy of a small country, how would you balance fairness and prosperity?',
    essential_understandings: [
      'Economic systems involve fundamental trade-offs between equality and efficiency.',
      'Data and evidence are essential for making and defending policy decisions.',
      'Different societies prioritize different values, leading to diverse economic systems.',
    ],
    authenticity_hook: 'Students engage with real economic data from real countries and present to a panel of adults acting as international advisors. Connects to current events around inequality, taxation, and public spending.',
    final_product: finalProduct,
    dok_level: 4,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Devil\'s Advocate protocol: each team must argue against another team\'s economic design, identifying weaknesses and unintended consequences. Teams then revise their designs based on the critique.',
    scaffolding_notes: 'Front-load economic vocabulary and concepts in Phase 1. Use the simulation game to build intuitive understanding before introducing formal terms. Provide data analysis scaffolds (graph templates, comparison charts) throughout.',
    differentiation,
    materials_and_resources: resources,
    tags: ['economics', 'math', 'social-studies', 'middle-school', 'policy'],
    status: 'published',
  }
}

// ============================================================
// 3. "The Story of Us"
// ============================================================

function storyOfUs(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Launch & Story Circle',
      description: 'Build community through storytelling. Teacher models by sharing a family story; students share in small circles.',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Teacher Story Model', description: 'Teacher shares a personal family/cultural story. Discuss what makes a story powerful: details, emotions, meaning.', activity_type: 'presentation', is_required: true, estimated_minutes: 30, resources: ['Photos or artifacts'], educator_notes: 'Be authentic and vulnerable. This sets the tone for student sharing.' },
        { id: uid(), title: 'Story Circles', description: 'In small groups of 4, students share a family or cultural story. Listeners practice active listening and asking follow-up questions.', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: ['Talking piece', 'Story circle guidelines'], educator_notes: 'Establish norms: respect, confidentiality, active listening. Allow passing.' },
        { id: uid(), title: 'Story Mapping', description: 'Students create a visual map of important stories from their family/culture. Identify themes and connections.', activity_type: 'reflection', is_required: true, estimated_minutes: 40, resources: ['Story map template', 'Colored markers'], educator_notes: 'Some students may need time and family help. Allow homework time.' },
      ],
      reflection_prompts: [
        'What story felt most important to you? Why?',
        'What did you learn from listening to others\' stories?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Collect & Interview',
      description: 'Conduct family interviews to gather stories, histories, and cultural practices.',
      duration_days: 5,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Interview Skills Workshop', description: 'Learn interviewing techniques: open-ended questions, follow-ups, recording methods. Practice with a partner.', activity_type: 'skill_building', is_required: true, estimated_minutes: 45, resources: ['Interview tips handout', 'Practice questions'], educator_notes: 'Model good and bad interviewing. Let students practice low-stakes first.' },
        { id: uid(), title: 'Family Interview', description: 'Conduct an interview with a family member or elder about family history, traditions, or an important story. Record or take detailed notes.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Interview guide template', 'Recording device (optional)'], educator_notes: 'Send home a parent/guardian letter explaining the project. Offer alternative: students can interview a community member or use family documents.' },
        { id: uid(), title: 'Story Selection & Draft', description: 'Review interview materials. Select the story or theme to develop into the final narrative piece.', activity_type: 'creation', is_required: true, estimated_minutes: 45, resources: ['Story selection worksheet'], educator_notes: 'Help students choose a focused, meaningful story — not everything, just one thread.' },
      ],
      reflection_prompts: [
        'What did you learn about your family that you didn\'t know before?',
        'How did it feel to be the interviewer?',
      ],
      checkpoint: {
        title: 'Interview Debrief',
        description: 'Share interview highlights with the class. Educator checks interview notes.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['Interview completed', 'Key story/theme identified', 'Detailed notes or recording collected'],
      },
    },
    {
      id: p3Id,
      title: 'Create & Craft',
      description: 'Develop the narrative piece and accompanying art. Multiple revision cycles with peer feedback.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Narrative Writing', description: 'Draft a narrative piece (personal essay, poem, or illustrated story) that brings the family story to life.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Writing prompts', 'Mentor texts', 'Revision checklist'], educator_notes: 'Offer mentor texts in multiple genres. Mini-lessons on dialogue, sensory detail, and structure.' },
        { id: uid(), title: 'Art Piece Creation', description: 'Create a visual art piece that complements the written narrative: painting, collage, textile art, photography, or mixed media.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Art supplies', 'Mixed media materials', 'Photography equipment'], educator_notes: 'Connect with the art teacher if possible. Focus on meaning over technique.' },
        { id: uid(), title: 'Writing Workshop & Critique', description: 'Peer writing circles: read drafts aloud, give and receive feedback using "Stars and Stairs" protocol.', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: ['Stars and Stairs feedback forms'], educator_notes: 'Model the feedback protocol. Emphasize kind, specific, and helpful feedback.' },
      ],
      reflection_prompts: [
        'How does your art piece connect to your written narrative?',
        'What revision made the biggest difference in your writing?',
      ],
      checkpoint: {
        title: 'Peer Writing Workshop',
        description: 'Peer feedback on narrative drafts using Stars and Stairs protocol.',
        assessment_type: 'peer_review',
        competency_ids: [],
        criteria: ['Draft complete and readable', 'Peer feedback given and received', 'Revision plan created'],
      },
    },
    {
      id: p4Id,
      title: 'Share & Celebrate',
      description: 'Community gallery exhibition where students share their stories and art with families.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Gallery Preparation', description: 'Finalize narratives and art. Design display layouts. Write artist statements explaining the connection between story and art.', activity_type: 'creation', is_required: true, estimated_minutes: 60, resources: ['Display materials', 'Artist statement template'], educator_notes: 'Help students curate their display. Artist statement should be accessible to families.' },
        { id: uid(), title: 'Community Gallery Opening', description: 'Host a gallery exhibition. Students stand by their work and share their stories with visitors. Families, community members, and other classes attend.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Gallery setup supplies', 'Guest book', 'Refreshments'], educator_notes: 'Make this celebratory. Invite families with personal invitations. Provide multilingual signage.' },
        { id: uid(), title: 'Closing Reflection Circle', description: 'Whole-class reflection: What did we learn about each other? How do our stories shape our community?', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Talking piece'], educator_notes: 'Circle up. Allow silence. This is about honoring the experience.' },
      ],
      reflection_prompts: [
        'What does it mean to share your family\'s story publicly?',
        'What did you learn about our classroom community through this project?',
        'How do stories connect people across differences?',
      ],
      checkpoint: {
        title: 'Gallery Reflection',
        description: 'Self-assessment of the creative process and learning.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Narrative is polished and meaningful', 'Art piece connects to the story', 'Student can articulate their learning journey'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose who to interview and what story thread to pursue.', choice_type: 'topic_selection', options: ['Parent/guardian', 'Grandparent/elder', 'Community member', 'Family documents/artifacts'] },
    { phase_id: p3Id, description: 'Choose the narrative format.', choice_type: 'product_format', options: ['Personal essay', 'Poem or spoken word', 'Illustrated story', 'Photo essay with captions', 'Comic/graphic narrative'] },
    { phase_id: p3Id, description: 'Choose the art medium.', choice_type: 'product_format', options: ['Painting/drawing', 'Collage', 'Photography', 'Textile/fiber art', 'Mixed media', 'Digital art'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A written narrative piece (essay, poem, or illustrated story) paired with a visual art piece, displayed at a community gallery exhibition.',
    format_options: ['Personal essay + painting', 'Poem + collage', 'Illustrated story + mixed media', 'Photo essay + photography series'],
    audience: 'Families, school community, and invited community members',
    presentation_format: 'Community gallery exhibition with student docents',
    quality_criteria: [
      'Narrative brings a family/cultural story to life with vivid detail',
      'Art piece connects meaningfully to the written narrative',
      'Artist statement explains the creative choices and personal significance',
      'Student can share their work and answer questions from gallery visitors',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Challenge students to interview multiple family members and weave perspectives together. Encourage research into the historical/cultural context of their story. Invite them to create a podcast episode or documentary.',
    supporting: 'Provide interview question banks, story starters, and graphic organizers. Offer one-on-one writing conferences. Allow oral storytelling as an alternative or supplement to written narrative.',
    ell_accommodations: 'Allow interviews in the family\'s home language. Provide bilingual writing support. Accept narratives written partially in the home language. Celebrate multilingualism in the gallery.',
    accessibility_notes: 'Offer audio recording as an alternative to written interviews. Provide adaptive art materials. Ensure gallery space is physically accessible. Allow digital art tools as alternatives to physical media.',
  }

  const resources: TemplateResource[] = [
    { title: 'StoryCorps Interview Guide', type: 'link', url: 'https://storycorps.org/participate/great-questions/', notes: 'Great questions for family interviews, organized by topic.' },
    { title: 'Stars and Stairs Feedback Protocol', type: 'printable', url: null, notes: 'Stars = what\'s working well; Stairs = specific steps to improve.' },
    { title: 'Artist Statement Template', type: 'printable', url: null, notes: 'Guided template: What is the story? Why does it matter? What choices did you make?' },
    { title: 'Each Kindness (Jacqueline Woodson)', type: 'book', url: null, notes: 'Mentor text for narrative writing about meaningful moments.' },
    { title: 'Gallery Setup Guide', type: 'printable', url: null, notes: 'Step-by-step guide for students to design and set up their gallery display.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'The Story of Us',
    description: 'Students interview family members, craft narrative pieces and art, and host a community gallery exhibition celebrating the diverse stories that shape their classroom community.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'upper_elementary',
    subject_area: ['ELA', 'Social Studies', 'Art'],
    estimated_duration_days: 18,
    driving_question: 'How do the stories of our families and cultures shape who we are as a community?',
    essential_understandings: [
      'Every person carries stories that shape their identity and worldview.',
      'Sharing personal stories builds empathy and strengthens community.',
      'Art and writing are powerful tools for preserving and honoring cultural heritage.',
    ],
    authenticity_hook: 'Deeply personal and cultural. Families are both the subject and the audience. The gallery exhibition makes private stories public in a celebratory context.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Stars and Stairs protocol for writing workshop. Stars = specific things that are working well. Stairs = specific, actionable steps to improve. All feedback must be kind, specific, and helpful.',
    scaffolding_notes: 'Build trust early with story circles and teacher modeling. Provide interview question banks and story starters. Use mentor texts to show what strong narrative writing looks and sounds like. Front-load the art connection.',
    differentiation,
    materials_and_resources: resources,
    tags: ['storytelling', 'community', 'art', 'ELA', 'upper-elementary', 'cultural-identity'],
    status: 'published',
  }
}

// ============================================================
// 4. "Mission to Mars: Engineering Our Future"
// ============================================================

function missionToMars(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Mission Briefing',
      description: 'Entry event: receive a "mission briefing" from NASA (video). Establish design constraints and form engineering teams.',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Mission Briefing Video', description: 'Watch a curated video about Mars exploration challenges. Discuss: what makes Mars hostile to life? What do humans need to survive?', activity_type: 'investigation', is_required: true, estimated_minutes: 45, resources: ['NASA Mars exploration videos', 'Mars fact sheet'], educator_notes: 'Use NASA\'s real mission briefing format. Build excitement and stakes.' },
        { id: uid(), title: 'Constraints Analysis', description: 'Identify the engineering constraints: atmosphere, temperature, radiation, water availability, distance from Earth. Organize into a constraints matrix.', activity_type: 'skill_building', is_required: true, estimated_minutes: 45, resources: ['Constraints matrix template', 'Mars data sheets'], educator_notes: 'Teach the concept of engineering constraints before students begin.' },
        { id: uid(), title: 'Team Formation & Roles', description: 'Form engineering teams of 4. Assign rotating roles: Project Lead, Research Specialist, Design Engineer, Documentation Officer.', activity_type: 'collaboration', is_required: true, estimated_minutes: 30, resources: ['Role cards', 'Team charter template'], educator_notes: 'Mix skill levels. Emphasize that all roles are equally important.' },
      ],
      reflection_prompts: [
        'Which Mars constraint do you think is most challenging to solve? Why?',
        'What role are you most excited about? What do you want to learn?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Research & Constraints',
      description: 'Deep research into specific habitat systems: life support, energy, food production, radiation shielding, and structural engineering.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'System Research Deep Dive', description: 'Each team member researches one habitat system. Use multiple sources: NASA papers, engineering articles, and interviews if possible.', activity_type: 'investigation', is_required: true, estimated_minutes: 120, resources: ['Research guide by system', 'Source evaluation checklist', 'NASA resources'], educator_notes: 'Provide curated source lists but require at least one self-found source.' },
        { id: uid(), title: 'Math: Scale & Measurement', description: 'Calculate habitat dimensions, energy needs, food production ratios, and material quantities using real Mars data.', activity_type: 'skill_building', is_required: true, estimated_minutes: 90, resources: ['Calculation worksheets', 'Mars environment data', 'Unit conversion charts'], educator_notes: 'Differentiate math complexity by team need. Provide calculator access.' },
        { id: uid(), title: 'Cross-Team Knowledge Share', description: 'Jigsaw: students who researched the same system meet across teams to compare findings, then return to their teams to synthesize.', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: ['Jigsaw protocol guide'], educator_notes: 'Structure the jigsaw carefully. Provide note-taking templates.' },
      ],
      reflection_prompts: [
        'What engineering solution impressed you most in your research?',
        'What did you learn from students on other teams?',
      ],
      checkpoint: {
        title: 'Research Review',
        description: 'Each team presents their system research findings. Educator checks for depth and accuracy.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['All four systems researched', 'Calculations completed and checked', 'Sources documented'],
      },
    },
    {
      id: p3Id,
      title: 'Design & Build',
      description: 'Design the habitat, build a scale model, and prepare the engineering report.',
      duration_days: 7,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Habitat Design', description: 'Create detailed habitat designs: floor plans, system diagrams, and materials specifications. Apply research findings to solve each constraint.', activity_type: 'creation', is_required: true, estimated_minutes: 150, resources: ['Graph paper', 'Design software (optional)', 'Scale rulers'], educator_notes: 'Require designs to address ALL constraints identified in Phase 1. No magic solutions.' },
        { id: uid(), title: 'Scale Model Construction', description: 'Build a physical scale model of the habitat using available materials. Include labeled systems.', activity_type: 'creation', is_required: true, estimated_minutes: 180, resources: ['Cardboard', 'Craft materials', 'Hot glue', '3D printing (if available)', 'Recycled materials'], educator_notes: 'Set a materials budget to teach resource constraints. Safety first with tools.' },
        { id: uid(), title: 'Engineering Report', description: 'Write a technical engineering report: problem statement, constraints, design rationale, calculations, and trade-offs.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Engineering report template'], educator_notes: 'Model technical writing. Emphasize clarity and precision over creativity.' },
      ],
      reflection_prompts: [
        'What was the biggest engineering challenge your team faced?',
        'What trade-off was hardest to accept in your design?',
      ],
      checkpoint: {
        title: 'Design Review',
        description: 'Teams present designs to another team for critical review before building.',
        assessment_type: 'group_critique',
        competency_ids: [],
        criteria: ['Design addresses all constraints', 'Calculations support the design', 'Trade-offs are explained'],
      },
    },
    {
      id: p4Id,
      title: 'Mission Review Board',
      description: 'Present habitat designs and engineering reports to a Mission Review Board panel.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Presentation Prep', description: 'Finalize model, prepare presentation slides, rehearse team presentation and Q&A defense.', activity_type: 'presentation', is_required: true, estimated_minutes: 60, resources: ['Presentation software'], educator_notes: 'Each team member must present a section. Practice handling tough questions.' },
        { id: uid(), title: 'Mission Review Board Presentation', description: 'Teams present to a panel of "mission reviewers" (teachers, parents, engineers if available). Panel evaluates designs on feasibility, innovation, and evidence.', activity_type: 'presentation', is_required: true, estimated_minutes: 120, resources: ['Evaluation rubrics for panelists', 'Timer'], educator_notes: 'Invite a STEM professional if possible. Brief panelists on rubric and expectations.' },
        { id: uid(), title: 'Mission Debrief', description: 'Class debrief: What did we learn about engineering? About teamwork? About Mars? Individual reflection journal entry.', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Reflection journal'], educator_notes: 'Celebrate effort and learning, not just "winning." All teams contribute to the mission.' },
      ],
      reflection_prompts: [
        'What engineering skill are you most proud of developing?',
        'How did your team overcome its biggest challenge?',
        'Would you want to go to Mars? Why or why not?',
      ],
      checkpoint: {
        title: 'Mission Debrief Reflection',
        description: 'Individual self-assessment of engineering skills and teamwork.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Can explain design choices with evidence', 'Reflects on collaboration and growth', 'Connects project to real engineering challenges'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which habitat system to specialize in during research.', choice_type: 'topic_selection', options: ['Life support (air/water)', 'Energy systems (solar/nuclear)', 'Food production (hydroponics/agriculture)', 'Structural engineering (radiation shielding, pressurization)'] },
    { phase_id: p3Id, description: 'Choose scale model construction approach.', choice_type: 'product_format', options: ['Physical model with recycled materials', '3D-printed components', 'Digital 3D model', 'Hybrid physical/digital'] },
    { phase_id: p3Id, description: 'Choose team collaboration structure during build phase.', choice_type: 'collaboration_structure', options: ['Parallel: each member builds their system', 'Sequential: one system at a time as a team', 'Pair-and-share: two sub-teams, then integrate'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A scale model of a sustainable Mars habitat with an accompanying engineering report, presented to a Mission Review Board panel.',
    format_options: ['Physical scale model + written report', 'Digital 3D model + written report', 'Hybrid model + multimedia report'],
    audience: 'Mission Review Board panel: teachers, parents, and STEM professionals',
    presentation_format: 'Formal Mission Review Board presentation with Q&A defense',
    quality_criteria: [
      'Habitat design addresses all identified constraints (atmosphere, temperature, radiation, water, food)',
      'Engineering report includes problem statement, calculations, design rationale, and trade-off analysis',
      'Scale model accurately represents the design with labeled systems',
      'Team presentation is clear, evidence-based, and handles Q&A professionally',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Challenge students to design for a multi-generational colony (not just initial habitat). Include psychological/social design considerations. Research actual NASA Artemis and Mars mission plans for comparison.',
    supporting: 'Provide pre-organized research packets by system. Offer calculation scaffolds and templates. Allow simpler model materials. Provide sentence starters for the engineering report.',
    ell_accommodations: 'Pre-teach STEM vocabulary with visual supports and bilingual glossaries. Provide labeled diagrams for research. Allow engineering reports to include diagrams in place of some text.',
    accessibility_notes: 'Offer digital modeling as an alternative to physical construction. Provide large-print data sheets. Ensure lab/workshop space is accessible. Allow flexible team roles based on student strengths.',
  }

  const resources: TemplateResource[] = [
    { title: 'NASA Mars Exploration', type: 'link', url: 'https://mars.nasa.gov', notes: 'Official NASA Mars mission data, images, and educational resources.' },
    { title: 'Engineering Design Process Poster', type: 'printable', url: null, notes: 'Visual guide to the engineering design cycle: Ask, Imagine, Plan, Create, Improve.' },
    { title: 'Mars Habitat Constraints Data Sheet', type: 'printable', url: null, notes: 'Compiled data on Mars atmospheric, temperature, radiation, and geological conditions.' },
    { title: 'Engineering Report Template', type: 'printable', url: null, notes: 'Scaffolded template: problem, constraints, design, calculations, trade-offs, conclusion.' },
    { title: 'The Martian (Andy Weir) - adapted excerpts', type: 'book', url: null, notes: 'Selected excerpts demonstrating engineering problem-solving on Mars (age-appropriate editing needed).' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Mission to Mars: Engineering Our Future',
    description: 'Engineering teams research Mars habitat constraints, design sustainable human habitats, build scale models, and present to a Mission Review Board — applying science, math, and technology to a real-world challenge.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'middle_school',
    subject_area: ['Science', 'Math', 'Technology'],
    estimated_duration_days: 20,
    driving_question: 'What would it take to design a sustainable human habitat on Mars?',
    essential_understandings: [
      'Engineering design requires understanding and balancing multiple constraints.',
      'Mathematical reasoning and data analysis are essential tools for solving real-world problems.',
      'Collaboration and iterative improvement lead to better designs than individual effort alone.',
    ],
    authenticity_hook: 'Connects to real NASA Mars exploration programs. Students tackle the same fundamental challenges that actual engineers face. Presentation to a panel including STEM professionals.',
    final_product: finalProduct,
    dok_level: 4,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Cross-team Design Review: teams present their designs to another team, who asks critical questions and identifies potential failure points. Teams document feedback and show how they addressed it in the final design.',
    scaffolding_notes: 'Use the engineering design process (Ask-Imagine-Plan-Create-Improve) as a throughline. Front-load key science concepts (atmosphere, radiation, thermodynamics). Provide calculation scaffolds and templates. Use mentor examples of engineering reports.',
    differentiation,
    materials_and_resources: resources,
    tags: ['engineering', 'STEM', 'Mars', 'middle-school', 'science', 'math'],
    status: 'published',
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Returns all seed templates ready for insertion.
 * Call with the target school_id and the creating user's profile ID.
 * competency_ids and skill_ids are empty — map to the school's
 * actual framework after insertion or let educators fill them in.
 */
export function getSeedTemplates(
  schoolId: string,
  createdBy: string
): AssignmentTemplateInsert[] {
  return [
    waterStory(schoolId, createdBy),
    fairEconomy(schoolId, createdBy),
    storyOfUs(schoolId, createdBy),
    missionToMars(schoolId, createdBy),
  ]
}
