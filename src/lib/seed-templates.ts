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

// ============================================================
// 5. "Our Roots, Our Table: A Community Food Story"
//    Place-based · Culturally immersive
// ============================================================

function ourRootsOurTable(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Taste & Wonder',
      description: 'Entry event: a community tasting table where families send in a dish or ingredient that matters to them. Students explore the question: where does our food come from, and why does it matter?',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Community Tasting Circle', description: 'Families contribute a food item with a short note about its significance. Students taste, observe, and record what they notice. Discuss: What makes a food "ours"?', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Tasting plates', 'Observation journals', 'Family invitation letters'], educator_notes: 'Send invitations home 2 weeks early. Be sensitive to dietary restrictions and food insecurity. Provide alternatives so every family can participate.' },
        { id: uid(), title: 'Food Memory Map', description: 'Students draw a visual map of the foods that are important in their family — special meals, holiday foods, comfort foods, garden foods. Share in small groups.', activity_type: 'reflection', is_required: true, estimated_minutes: 40, resources: ['Large paper', 'Colored markers', 'Food memory prompt cards'], educator_notes: 'Model with your own food memory map first. Emphasize that every food tradition matters equally.' },
        { id: uid(), title: 'Wonder Wall', description: 'Generate questions about food: Where does it grow? Who grows it here? What did our grandparents eat? How has our food changed? Post questions on the Wonder Wall.', activity_type: 'investigation', is_required: true, estimated_minutes: 30, resources: ['Sticky notes', 'Wonder Wall poster'], educator_notes: 'Group questions into themes for investigation phase. Let student questions drive the inquiry.' },
      ],
      reflection_prompts: [
        'What food connects you most strongly to your family or culture? Why?',
        'What surprised you about the foods your classmates shared?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Investigate & Harvest',
      description: 'Research local food systems, interview family elders about food traditions, visit local farms or gardens, and study the science of growing food in this place.',
      duration_days: 8,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Elder Food Interview', description: 'Interview a family elder or community member about food traditions: What did they eat growing up? How did they get food? What recipes have been passed down? What has changed?', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Interview guide with culturally sensitive prompts', 'Recording device (optional)', 'Thank-you card supplies'], educator_notes: 'Provide interview guides in families\' home languages. Allow video or audio recording. Some students may interview in person, others by phone. Offer a school-based elder visit as alternative.' },
        { id: uid(), title: 'Local Food System Investigation', description: 'Research where food in the community comes from: visit a local farm, garden, market, or food bank. Map the journey of a food item from seed to plate.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Field trip permission forms', 'Food journey mapping template', 'Clipboards'], educator_notes: 'Partner with a local farm, community garden, or farmers market. If field trip is not possible, invite a local grower to class or use virtual farm tours.' },
        { id: uid(), title: 'Soil & Seed Science', description: 'Hands-on investigation: test garden soil, plant seeds, observe germination. Connect to the science of how food grows in this specific climate and geography.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Soil test kits', 'Seeds (culturally significant varieties)', 'Planting containers', 'Science journals'], educator_notes: 'Choose seeds that connect to students\' cultures when possible — herbs, vegetables, or grains from family traditions. Even a windowsill garden works.' },
        { id: uid(), title: 'Recipe Documentation', description: 'Students document a family recipe with precise measurements, cultural context, and the story behind the dish. Practice informational writing and measurement skills.', activity_type: 'creation', is_required: true, estimated_minutes: 60, resources: ['Recipe template', 'Measurement tools', 'Cultural context worksheet'], educator_notes: 'Some recipes are oral traditions without written measurements — help students convert "a handful" to cups. Honor approximation as a cultural practice.' },
      ],
      reflection_prompts: [
        'What did you learn from your elder that you didn\'t know before?',
        'How is the way your family gets food different from 50 years ago?',
        'What connections do you see between the land here and the food we eat?',
      ],
      checkpoint: {
        title: 'Research Portfolio Check',
        description: 'Educator reviews interview notes, food journey map, science observations, and documented recipe.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['Elder interview completed with detailed notes', 'Food journey mapped from source to table', 'At least one science investigation documented', 'Family recipe recorded with cultural context'],
      },
    },
    {
      id: p3Id,
      title: 'Cook & Create',
      description: 'Develop the community cookbook: test and refine recipes, write food stories, create illustrations, and design the book together.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Test Kitchen Day', description: 'Students prepare their family recipe (or a simplified version) for classmates. Practice measurement, sequencing, and food safety. Classmates taste and provide feedback.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Kitchen access or portable cooking equipment', 'Ingredients', 'Food safety guidelines', 'Tasting feedback forms'], educator_notes: 'Coordinate with the school kitchen. Address allergies carefully. Students who can\'t cook at school can bring prepared food or demonstrate with photos/video.' },
        { id: uid(), title: 'Food Story Writing', description: 'Write the story behind the recipe: who taught it, when it\'s made, what it means, how it connects to culture and place. Combine narrative and informational writing.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Writing prompts', 'Mentor food stories', 'Revision checklist'], educator_notes: 'Share mentor texts from food writers who connect food to culture. Mini-lessons on sensory detail and cultural context.' },
        { id: uid(), title: 'Illustration & Photography', description: 'Create visual art for the cookbook: watercolor illustrations of ingredients, photographs of cooking process, or cultural artwork that connects food to heritage.', activity_type: 'creation', is_required: true, estimated_minutes: 60, resources: ['Art supplies', 'Cameras or tablets', 'Watercolor sets'], educator_notes: 'Connect with the art teacher. Encourage students to include cultural motifs and patterns from their heritage.' },
        { id: uid(), title: 'Peer Critique: Tasting & Reading', description: 'Peer feedback on both the recipe (clarity, completeness) and the food story (voice, detail, cultural connection). Use "I notice / I wonder / What if" protocol.', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: ['Feedback protocol sheets', 'Sticky notes'], educator_notes: 'Focus on both the recipe as a functional text and the story as a narrative. Both need to work together.' },
      ],
      reflection_prompts: [
        'What was it like to share your family\'s food with classmates?',
        'What feedback helped you improve your recipe or story?',
        'How does writing about food help preserve cultural traditions?',
      ],
      checkpoint: {
        title: 'Peer Recipe & Story Review',
        description: 'Peer feedback on draft recipes and food stories using structured protocol.',
        assessment_type: 'peer_review',
        competency_ids: [],
        criteria: ['Recipe is clear and repeatable', 'Food story conveys cultural meaning', 'Illustration connects to the dish and its story', 'Peer feedback given and incorporated'],
      },
    },
    {
      id: p4Id,
      title: 'Feast & Share',
      description: 'Community potluck feast and cookbook launch. Students present their food stories, share dishes, and distribute the community cookbook.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Cookbook Assembly', description: 'Compile all recipes, stories, and illustrations into a class cookbook. Design a cover, write an introduction, and organize by theme or region.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Book binding supplies or digital publishing tool', 'Cover art materials'], educator_notes: 'Print copies for every family. Consider a digital version families can share with extended family. The introduction should honor every contributor.' },
        { id: uid(), title: 'Community Feast', description: 'Host a potluck where families bring dishes from the cookbook. Students stand by their recipe station to share the story behind their dish.', activity_type: 'presentation', is_required: true, estimated_minutes: 120, resources: ['Table setup supplies', 'Recipe station cards', 'Cookbook copies for distribution', 'Multilingual welcome signs'], educator_notes: 'Make this a true celebration. Play music from students\' cultures. Have multilingual signage. Ensure every family feels honored. Provide food for families who cannot bring a dish.' },
        { id: uid(), title: 'Gratitude Circle', description: 'Closing reflection: What did food teach us about each other? Write thank-you notes to the elders and community members who contributed.', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Thank-you cards', 'Talking piece'], educator_notes: 'Allow time for genuine appreciation. This project touches on identity and belonging — honor the emotional weight.' },
      ],
      reflection_prompts: [
        'What does food teach us about culture that words alone cannot?',
        'How did sharing your family\'s food story make you feel?',
        'What will you remember most from this project?',
      ],
      checkpoint: {
        title: 'Feast Reflection',
        description: 'Self-assessment of learning journey and cultural understanding.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Cookbook contribution is complete and polished', 'Food story connects recipe to culture and place', 'Student can articulate what they learned about community through food'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which food tradition or recipe to investigate deeply.', choice_type: 'topic_selection', options: ['A holiday/celebration dish', 'An everyday comfort food', 'A food grown in a family garden', 'A recipe passed down through generations', 'A food that connects to the land here'] },
    { phase_id: p2Id, description: 'Choose investigation method for local food systems.', choice_type: 'research_method', options: ['Farm or garden visit', 'Farmers market investigation', 'Grocery store supply chain research', 'School garden growing experiment'] },
    { phase_id: p3Id, description: 'Choose how to illustrate your cookbook page.', choice_type: 'product_format', options: ['Watercolor illustration', 'Photography', 'Cultural pattern artwork', 'Mixed media collage', 'Digital illustration'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A class community cookbook combining family recipes, food stories, cultural illustrations, and the science of local food — launched at a community potluck feast.',
    format_options: ['Printed cookbook + potluck feast', 'Digital cookbook + virtual food story sharing', 'Printed cookbook + food story podcast episodes'],
    audience: 'Families, school community, local community organizations, and elders who contributed',
    presentation_format: 'Community potluck feast with recipe stations and cookbook launch',
    quality_criteria: [
      'Recipe is accurate, clear, and includes measurements that work',
      'Food story weaves together personal memory, cultural meaning, and place',
      'Illustration reflects the cultural identity connected to the food',
      'Student can share the story behind their dish with guests',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Research the agricultural history of the region. Compare traditional and industrial food systems. Create a "food justice" section analyzing access to culturally significant foods in the community. Interview multiple generations to trace how a recipe has changed over time.',
    supporting: 'Provide recipe templates with sentence starters. Pair students for interviews. Offer photo-based food story alternatives. Simplify cooking activities with no-cook recipes. Provide graphic organizers for food journey mapping.',
    ell_accommodations: 'Conduct elder interviews in home language. Accept bilingual recipes and stories — celebrate multilingual cookbooks. Provide visual vocabulary for cooking terms. Allow food stories to be told orally and transcribed.',
    accessibility_notes: 'Offer sensory-safe tasting alternatives (visual, smell-only). Provide adaptive cooking tools. Allow digital illustration tools. Ensure feast space is accessible. Offer alternative presentation formats for students who find large gatherings challenging.',
  }

  const resources: TemplateResource[] = [
    { title: 'StoryCorps Great Questions', type: 'link', url: 'https://storycorps.org/participate/great-questions/', notes: 'Adapt for food-focused elder interviews.' },
    { title: 'Food & Culture Interview Guide', type: 'printable', url: null, notes: 'Culturally sensitive interview prompts about food traditions, available in multiple languages.' },
    { title: 'Recipe Template with Cultural Context', type: 'printable', url: null, notes: 'Structured template: ingredients, steps, the story behind the dish, and where it comes from.' },
    { title: 'Seed to Table Science Journal', type: 'printable', url: null, notes: 'Observation journal for soil testing, seed germination, and local growing conditions.' },
    { title: 'Book Creator', type: 'tool', url: 'https://bookcreator.com', notes: 'Digital tool for assembling the class cookbook with text, photos, and illustrations.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Our Roots, Our Table: A Community Food Story',
    description: 'Students investigate local food systems, interview family elders about food traditions, test recipes, and create a community cookbook launched at a potluck feast — exploring how food connects culture, science, and place.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'elementary',
    subject_area: ['Science', 'Social Studies', 'ELA'],
    estimated_duration_days: 21,
    driving_question: 'Where does our food come from, and what do the foods we share tell us about who we are?',
    essential_understandings: [
      'Food connects people to land, culture, history, and each other.',
      'Every family carries food traditions that reflect their identity and heritage.',
      'Understanding where food comes from helps us make choices that honor the land and our communities.',
    ],
    authenticity_hook: 'Families are co-creators: elders share recipes and stories, the class produces a real cookbook, and the project culminates in a community feast where everyone\'s food tradition is celebrated.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'I Notice / I Wonder / What If — applied to both recipes (as functional texts) and food stories (as cultural narratives). Tasting feedback focuses on sensory experience; story feedback focuses on cultural meaning and voice.',
    scaffolding_notes: 'Begin with the tasting circle to build trust and curiosity. Front-load interview skills before elder conversations. Model recipe writing with a shared class recipe. Use food memory maps as pre-writing. Honor oral traditions by allowing storytelling before writing.',
    differentiation,
    materials_and_resources: resources,
    tags: ['place-based', 'culturally-immersive', 'food', 'community', 'science', 'oral-history', 'elementary'],
    status: 'published',
  }
}

// ============================================================
// 6. "Guardians of This Place: Caring for Our Land"
//    Place-based · Culturally immersive
// ============================================================

function guardiansOfThisPlace(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Walk & Notice',
      description: 'Slow, intentional walks through the school grounds and surrounding land. Students practice deep observation through nature journaling and cultural listening.',
      duration_days: 4,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Silent Sit Spot', description: 'Each student finds a spot on the school grounds and sits silently for 10 minutes, observing with all senses. Sketch and write what they notice: plants, insects, soil, water, sounds, smells.', activity_type: 'field_work', is_required: true, estimated_minutes: 30, resources: ['Nature journals', 'Pencils', 'Sit spot map of school grounds'], educator_notes: 'Practice this 3 times during the phase. Students return to the SAME spot each time to notice change. Model your own sit spot practice.' },
        { id: uid(), title: 'Land Story Circle', description: 'Gather in a circle outdoors. Ask: Who has lived on this land before us? How did they care for it? What do our families know about the land here? Share knowledge and questions.', activity_type: 'collaboration', is_required: true, estimated_minutes: 40, resources: ['Talking piece', 'Historical land map (if available)'], educator_notes: 'Research the indigenous history of your school\'s location beforehand. Approach with humility and respect. If possible, invite a local indigenous community member or historian.' },
        { id: uid(), title: 'Neighborhood Land Walk', description: 'Walk through the surrounding area observing how land is used: gardens, parks, paved areas, waterways, wild spaces. Document with sketches and photographs.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Clipboards', 'Cameras or tablets', 'Land use observation sheet'], educator_notes: 'Walk slowly. Stop frequently. Ask students to notice what\'s growing, what\'s paved, what\'s wild. Compare to what this land might have looked like 100 or 500 years ago.' },
      ],
      reflection_prompts: [
        'What did you notice at your sit spot that you\'ve never noticed before?',
        'What do you think this land looked like before the school was built?',
        'What does "caring for the land" mean to your family or culture?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Listen & Learn',
      description: 'Learn from community knowledge holders: elders, indigenous community members, local ecologists, and family members with land-based knowledge. Conduct ecological surveys of the school grounds.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Community Knowledge Holder Visit', description: 'Invite someone with deep knowledge of this land — an indigenous community member, longtime resident, local ecologist, or traditional gardener — to share how people have cared for this place.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Guest invitation letter', 'Thank-you gift', 'Student question cards'], educator_notes: 'Reach out to local indigenous organizations, garden clubs, historical societies, or environmental groups. Compensate guest speakers when possible. Prepare students to listen respectfully.' },
        { id: uid(), title: 'Ecological Survey', description: 'Conduct a biodiversity survey of the school grounds: count plant species, identify insects, test soil pH, measure shade coverage. Record all data.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Plant identification guides', 'Soil test kits', 'Insect collection tools', 'Data recording sheets', 'Magnifying glasses'], educator_notes: 'Use local field guides. Encourage students to learn both scientific and traditional/cultural names for plants. Compare healthy vs. stressed areas.' },
        { id: uid(), title: 'Family Land Knowledge Interview', description: 'Interview a family member about their relationship with land: gardening, farming, foraging, traditional plant knowledge, or memories of how the land has changed.', activity_type: 'field_work', is_required: true, estimated_minutes: 45, resources: ['Interview guide', 'Recording device'], educator_notes: 'Many families carry rich land-based knowledge — farming traditions, medicinal plant use, seasonal practices. Frame the interview to honor this knowledge as expertise.' },
        { id: uid(), title: 'Historical Land Research', description: 'Research how this specific land has changed over time: indigenous use, colonial history, development, and environmental changes. Use maps, photos, and community archives.', activity_type: 'investigation', is_required: true, estimated_minutes: 60, resources: ['Historical maps', 'Local history archives', 'Research worksheet'], educator_notes: 'Use the Native Land Digital map (native-land.ca) as a starting point. Local libraries and historical societies often have aerial photos and old maps.' },
      ],
      reflection_prompts: [
        'What land-care practice from our guest speaker resonated with you most? Why?',
        'What did the ecological survey reveal about the health of our school grounds?',
        'What knowledge does your family carry about caring for land?',
      ],
      checkpoint: {
        title: 'Knowledge Portfolio Review',
        description: 'Educator reviews ecological survey data, interview notes, and historical research.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['Ecological survey completed with data', 'Community or family interview documented', 'Historical land changes identified', 'Connection between cultural knowledge and ecological health explored'],
      },
    },
    {
      id: p3Id,
      title: 'Design & Plan',
      description: 'Design a land stewardship project for the school or community that integrates scientific data, community input, and cultural knowledge.',
      duration_days: 6,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Problem Identification Workshop', description: 'Using ecological survey data and community knowledge, identify a specific land-care need: a pollinator garden, native plant restoration, rain garden, composting system, or outdoor learning space.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Survey data summary', 'Community input notes', 'Problem identification template'], educator_notes: 'Guide students to choose something achievable. Connect the project to both ecological needs and cultural values. The best projects honor indigenous plant knowledge.' },
        { id: uid(), title: 'Stewardship Plan Design', description: 'Teams design their land stewardship project: site map, plant selection (prioritizing native and culturally significant species), timeline, materials needed, and maintenance plan.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Graph paper for site maps', 'Native plant guides', 'Budget worksheet', 'Project planning template'], educator_notes: 'Encourage teams to include plants that are culturally significant to students\' families alongside native species. Research which plants were traditionally grown or gathered here.' },
        { id: uid(), title: 'Community Feedback Session', description: 'Present draft plans to community members, families, or school administrators for feedback. Revise based on input.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Presentation materials', 'Feedback forms'], educator_notes: 'Invite the knowledge holders from Phase 2 back. Their feedback ensures cultural authenticity and ecological accuracy. This is also a chance to deepen community partnerships.' },
      ],
      reflection_prompts: [
        'How does your design honor both ecological science and cultural knowledge?',
        'What feedback changed your plan? Why did you accept or adapt it?',
        'How will this project benefit people and the land 10 years from now?',
      ],
      checkpoint: {
        title: 'Community Design Review',
        description: 'Community members and educator review stewardship project plans.',
        assessment_type: 'group_critique',
        competency_ids: [],
        criteria: ['Design addresses a real ecological need', 'Plan integrates cultural and scientific knowledge', 'Community feedback incorporated', 'Project is achievable within available resources'],
      },
    },
    {
      id: p4Id,
      title: 'Plant & Celebrate',
      description: 'Implement the stewardship project and celebrate with the community through a land dedication ceremony.',
      duration_days: 4,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Implementation Day', description: 'Hands-on implementation: plant native species, build garden beds, install signage, or create the outdoor learning space. Community volunteers welcome.', activity_type: 'creation', is_required: true, estimated_minutes: 180, resources: ['Plants', 'Soil', 'Garden tools', 'Signage materials', 'Volunteer coordination plan'], educator_notes: 'This is a community event. Invite families to work alongside students. Play music, share food, make it celebratory. Document with photos and video.' },
        { id: uid(), title: 'Land Dedication & Storytelling', description: 'Host a ceremony to dedicate the project. Students share what they learned about this place, read poems or stories, and explain how the project honors the land and community.', activity_type: 'presentation', is_required: true, estimated_minutes: 60, resources: ['Ceremony program', 'Student presentation materials', 'Dedication plaque or sign'], educator_notes: 'Let students design the ceremony. It should honor the land, the knowledge holders who contributed, and the community. Consider seasonal or cultural traditions for the format.' },
        { id: uid(), title: 'Stewardship Pledge & Reflection', description: 'Write a personal stewardship pledge for ongoing care of the project. Reflect on the full learning journey from sit spot to implementation.', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Pledge cards', 'Reflection journals'], educator_notes: 'Create a maintenance schedule so the project thrives beyond this class. Assign ongoing stewardship roles.' },
      ],
      reflection_prompts: [
        'What does it mean to be a guardian of a place?',
        'How did different kinds of knowledge — scientific, cultural, personal — come together in this project?',
        'What responsibility do you feel toward this land now?',
      ],
      checkpoint: {
        title: 'Stewardship Self-Assessment',
        description: 'Individual reflection on learning journey and ongoing land-care commitment.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Can explain the ecological reasoning behind design choices', 'Can describe the cultural knowledge that informed the project', 'Demonstrates personal connection to land stewardship'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which ecological investigation to lead.', choice_type: 'topic_selection', options: ['Soil health & composition', 'Plant biodiversity survey', 'Pollinator & insect census', 'Water flow & drainage mapping', 'Bird & wildlife observation'] },
    { phase_id: p3Id, description: 'Choose the type of stewardship project to design.', choice_type: 'topic_selection', options: ['Native plant & pollinator garden', 'Rain garden or water feature', 'Outdoor classroom with cultural plantings', 'Composting & food garden system', 'Habitat restoration area'] },
    { phase_id: p4Id, description: 'Choose how to share the project story.', choice_type: 'presentation_style', options: ['Land dedication ceremony with spoken word', 'Documentary video of the project journey', 'Illustrated field guide of the restored space', 'Photo essay with ecological and cultural captions'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A real land stewardship project implemented on school grounds or in the community, combining ecological science with cultural land-care knowledge, celebrated through a community dedication ceremony.',
    format_options: ['Garden/restoration + dedication ceremony', 'Garden/restoration + documentary video', 'Garden/restoration + illustrated field guide'],
    audience: 'School community, families, local environmental organizations, and community knowledge holders who contributed',
    presentation_format: 'Community land dedication ceremony with student presentations and ongoing stewardship plan',
    quality_criteria: [
      'Project addresses a genuine ecological need identified through scientific investigation',
      'Design integrates both scientific data and cultural/traditional knowledge about land care',
      'Students can explain the reasoning behind plant choices and design decisions',
      'Community voice is authentically incorporated into the project',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Research traditional ecological knowledge (TEK) practices from multiple cultures. Create a seasonal stewardship calendar based on indigenous phenology. Write a proposal for expanding the project to additional school or community sites. Develop a monitoring plan to track ecological changes over time.',
    supporting: 'Provide visual plant identification cards. Use structured observation templates for sit spots. Pair students for ecological surveys. Offer sentence starters for reflections. Simplify the design plan with guided templates. Focus on a smaller, more contained project area.',
    ell_accommodations: 'Learn and use plant names in students\' home languages alongside scientific names. Conduct family interviews in home language. Provide visual glossaries for ecological terms. Allow multilingual signage in the final project. Celebrate plant knowledge from students\' home countries.',
    accessibility_notes: 'Ensure sit spots and field work areas are physically accessible. Provide raised garden beds for wheelchair access. Offer sensory-rich alternatives for observation (texture, sound, scent). Allow indoor observation alternatives during inclement weather. Provide adaptive gardening tools.',
  }

  const resources: TemplateResource[] = [
    { title: 'Native Land Digital', type: 'link', url: 'https://native-land.ca', notes: 'Interactive map of indigenous territories, languages, and treaties. Starting point for land history research.' },
    { title: 'Local Native Plant Guide', type: 'printable', url: null, notes: 'Region-specific guide to native plants suitable for school gardens. Source from local extension office or native plant society.' },
    { title: 'Sit Spot Nature Journal', type: 'printable', url: null, notes: 'Structured journal pages for repeated observation: date, weather, what I see/hear/smell/feel, sketches.' },
    { title: 'Ecological Survey Data Sheets', type: 'printable', url: null, notes: 'Templates for plant counts, soil pH records, insect tallies, and biodiversity indices.' },
    { title: 'Braiding Sweetgrass (Robin Wall Kimmerer)', type: 'book', url: null, notes: 'Excerpts on reciprocal relationships with the land. Adapt for read-alouds. Rich perspective on science + indigenous knowledge.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Guardians of This Place: Caring for Our Land',
    description: 'Students investigate the ecology of their school grounds, learn from community elders and knowledge holders about cultural relationships with land, and design and implement a real stewardship project that honors both science and tradition.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'upper_elementary',
    subject_area: ['Science', 'Social Studies'],
    estimated_duration_days: 21,
    driving_question: 'How have the people of this place cared for the land, and what is our responsibility to carry that forward?',
    essential_understandings: [
      'Every place has a story — shaped by the people who have lived there and the ecological systems that sustain it.',
      'Scientific knowledge and cultural knowledge are both essential for understanding and caring for land.',
      'Stewardship means taking active responsibility for the health of the places we belong to.',
    ],
    authenticity_hook: 'Students create a REAL, lasting change on their school grounds or in their community. The project is informed by community knowledge holders and results in a physical space that benefits people and ecosystems for years to come.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Community Design Review: knowledge holders and community members give feedback on stewardship plans, ensuring cultural authenticity and ecological accuracy. Students revise based on this expert critique.',
    scaffolding_notes: 'Begin with the sit spot practice to slow students down and develop observation skills. Build cultural respect before the knowledge holder visit. Use ecological surveys to ground the project in data. Let community feedback genuinely shape the design — this is not performative.',
    differentiation,
    materials_and_resources: resources,
    tags: ['place-based', 'culturally-immersive', 'ecology', 'stewardship', 'indigenous-knowledge', 'garden', 'upper-elementary'],
    status: 'published',
  }
}

// ============================================================
// 7. "Voices of Our Place: A Living Community Atlas"
//    Place-based · Culturally immersive
// ============================================================

function voicesOfOurPlace(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Wander & Map',
      description: 'Explore the neighborhood through guided walks, identifying places that hold meaning for community members. Begin mapping the landscape of stories.',
      duration_days: 4,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Neighborhood Story Walk', description: 'Walk through the surrounding community with intention. At each stop, ask: Who gathers here? What happens here? What stories might this place hold? Photograph and sketch significant locations.', activity_type: 'field_work', is_required: true, estimated_minutes: 75, resources: ['Walking route map', 'Cameras or tablets', 'Observation notebooks', 'Permission slips'], educator_notes: 'Walk slowly. Stop at places that seem ordinary — the corner store, the park bench, the mural, the church. Significance isn\'t always visible. Have students identify at least 10 "story places."' },
        { id: uid(), title: 'My Place Map', description: 'Each student creates a personal map of the places that matter to them in their neighborhood: where they play, worship, eat, visit family, feel safe, feel joy.', activity_type: 'reflection', is_required: true, estimated_minutes: 45, resources: ['Large paper', 'Colored markers', 'Map prompts'], educator_notes: 'This is not about accuracy — it\'s about meaning. The map reveals what matters to each child. Some students may include places from a previous home or country.' },
        { id: uid(), title: 'Class Story Map', description: 'Overlay individual place maps onto a large class map of the neighborhood. Notice clusters of meaning, shared places, and gaps. Identify which places to investigate deeper.', activity_type: 'collaboration', is_required: true, estimated_minutes: 40, resources: ['Large neighborhood base map', 'Colored pins or stickers', 'Legend template'], educator_notes: 'Patterns emerge: cultural hubs, generational gathering places, hidden histories. Let students decide which places to investigate — their curiosity drives the atlas.' },
      ],
      reflection_prompts: [
        'What place on your map holds the strongest memories or feelings?',
        'What did you learn about the neighborhood from your classmates\' maps?',
        'Are there places in our community whose stories might be forgotten if no one records them?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Listen & Record',
      description: 'Conduct oral history interviews with community members who hold the stories of significant places. Document with audio, video, photography, and writing.',
      duration_days: 8,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Oral History Training', description: 'Learn interviewing techniques from the StoryCorps model: open-ended questions, active listening, follow-up questions, recording ethics, and getting consent.', activity_type: 'skill_building', is_required: true, estimated_minutes: 60, resources: ['StoryCorps question list', 'Recording equipment', 'Consent form template', 'Practice interview guide'], educator_notes: 'Practice interviews in class first. Emphasize respect, consent, and the sacredness of someone sharing their story. Discuss what to do when stories are painful or private.' },
        { id: uid(), title: 'Community Oral History Interviews', description: 'In pairs, interview community members about a specific place: business owners, elders, longtime residents, faith leaders, artists, or community organizers. Record and photograph.', activity_type: 'field_work', is_required: true, estimated_minutes: 90, resources: ['Recording device', 'Camera', 'Interview guide', 'Consent forms', 'Thank-you gifts'], educator_notes: 'Help students identify interviewees through family networks, community organizations, and local businesses. Accompany student pairs or arrange in-school interviews. Some stories may be in languages other than English — celebrate this.' },
        { id: uid(), title: 'Site Documentation', description: 'Return to each "story place" to create detailed documentation: photographs from multiple angles, architectural sketches, sensory descriptions, and geographic measurements.', activity_type: 'investigation', is_required: true, estimated_minutes: 60, resources: ['Camera', 'Sketch pad', 'Sensory description worksheet', 'GPS or mapping app'], educator_notes: 'Teach basic documentary photography. Encourage students to capture both the big picture and small details that make a place special.' },
        { id: uid(), title: 'Historical Research', description: 'Research the history of selected places using community archives, library records, historical photographs, and newspaper articles.', activity_type: 'investigation', is_required: false, estimated_minutes: 60, resources: ['Library access', 'Local historical society contacts', 'Research template'], educator_notes: 'Local libraries often have historical photo archives. Community newspapers may have old articles. Cross-reference oral histories with archival records — notice whose stories are and aren\'t in the official records.' },
      ],
      reflection_prompts: [
        'What did you learn from your interview that surprised you?',
        'Whose stories are well-known in our community? Whose are hidden or at risk of being lost?',
        'How does a place hold memory?',
      ],
      checkpoint: {
        title: 'Story Collection Review',
        description: 'Educator reviews interview recordings, photographs, site documentation, and research notes.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['At least one oral history interview completed and recorded', 'Story place documented with photos and descriptions', 'Interviewee consent obtained', 'Key themes and quotes identified from interview'],
      },
    },
    {
      id: p3Id,
      title: 'Weave & Build',
      description: 'Transform raw interviews and documentation into atlas entries. Create the community atlas combining maps, stories, photographs, and art.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Story Crafting', description: 'Shape interview materials into a compelling atlas entry: select key quotes, write narrative context, choose photographs, and create a map pin description for the location.', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: ['Story crafting template', 'Interview transcripts or notes', 'Photos', 'Quote selection worksheet'], educator_notes: 'Model how to shape raw interview material into a story while preserving the interviewee\'s voice. The story belongs to the person who told it — students are the scribes, not the authors.' },
        { id: uid(), title: 'Atlas Art & Design', description: 'Create visual art for the atlas entry: illustrated maps, portraits of interviewees, cultural motifs, or place-based artwork that captures the spirit of each story place.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Art supplies', 'Portrait drawing guides', 'Map illustration examples'], educator_notes: 'Encourage a variety of artistic styles. The atlas should reflect the visual diversity of the community. Connect with the art teacher for portrait techniques.' },
        { id: uid(), title: 'Atlas Assembly & Peer Review', description: 'Assemble individual entries into a cohesive atlas. Review each other\'s entries for clarity, accuracy, and respectful representation. Design the atlas format and navigation.', activity_type: 'collaboration', is_required: true, estimated_minutes: 90, resources: ['Atlas layout templates', 'Peer review checklist', 'Binding or digital publishing tools'], educator_notes: 'Discuss: How do we organize a community atlas? By geography? By theme? By time period? Let students decide the structure. Ensure every community represented in the classroom has a presence in the atlas.' },
      ],
      reflection_prompts: [
        'How did you decide what to include and what to leave out of your entry?',
        'What responsibility comes with telling someone else\'s story?',
        'How does organizing stories on a map change how we see our community?',
      ],
      checkpoint: {
        title: 'Peer Atlas Review',
        description: 'Peer feedback on atlas entries: accuracy, voice, visual quality, and respectful representation.',
        assessment_type: 'peer_review',
        competency_ids: [],
        criteria: ['Story entry preserves interviewee\'s voice and intent', 'Photos and art complement the narrative', 'Map location is accurate and description is clear', 'Entry treats the subject with dignity and respect'],
      },
    },
    {
      id: p4Id,
      title: 'Unveil & Gift',
      description: 'Launch the community atlas at a public event. Gift copies to interviewees, the school library, community organizations, and the local historical society.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Atlas Launch Event', description: 'Host a community unveiling of the atlas. Students present selected entries, interviewees are honored as guests, and atlas copies are distributed. Include a guided "story walk" through the atlas.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Printed atlas copies', 'Display setup', 'Guest invitations', 'Refreshments', 'Program with student names'], educator_notes: 'This is a gift-giving event. Every interviewee should receive a copy. Invite media. Create a display that lets visitors browse the atlas. Have students stationed at their entries to share.' },
        { id: uid(), title: 'Thank-You & Reciprocity', description: 'Write personal thank-you letters to interviewees. Discuss reciprocity: What have we given back to the community for sharing their stories with us? How will we continue to care for these stories?', activity_type: 'reflection', is_required: true, estimated_minutes: 40, resources: ['Thank-you card supplies', 'Stamps and envelopes'], educator_notes: 'Reciprocity is a core value of place-based and culturally responsive work. The atlas itself is a gift back — but the relationship is what matters most.' },
        { id: uid(), title: 'Legacy & Continuation', description: 'Discuss how to keep the atlas alive: digital version on the school website, annual additions by future classes, connection to the local historical society. Plan next steps.', activity_type: 'collaboration', is_required: true, estimated_minutes: 30, resources: ['Digital publishing platform', 'Historical society contacts'], educator_notes: 'The best atlases grow over time. Set up a system for future classes to add entries. Consider partnering with the local historical society for archival.' },
      ],
      reflection_prompts: [
        'What will this atlas mean to our community 20 years from now?',
        'What did you learn about your neighborhood that changed how you see it?',
        'What story would you want someone to tell about YOUR life and place?',
      ],
      checkpoint: {
        title: 'Atlas Launch Reflection',
        description: 'Self-assessment of the full learning journey from walking to publishing.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Atlas entry is complete, polished, and respectful', 'Student can articulate what they learned about community through oral history', 'Student demonstrates understanding of the responsibility of storytelling'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p1Id, description: 'Choose which "story places" to investigate deeper.', choice_type: 'topic_selection', options: ['A place of gathering (park, plaza, community center)', 'A cultural landmark (mural, monument, place of worship)', 'A business with a story (shop, restaurant, market)', 'A natural feature (creek, hill, old tree)', 'A place that has changed significantly'] },
    { phase_id: p2Id, description: 'Choose who to interview about the story place.', choice_type: 'research_method', options: ['A longtime resident or elder', 'A business owner or worker', 'A community organizer or faith leader', 'An artist or cultural practitioner', 'A family member with memories of the place'] },
    { phase_id: p3Id, description: 'Choose the format for your atlas entry.', choice_type: 'product_format', options: ['Written narrative + photographs', 'Audio story + illustrated map', 'Video mini-documentary + map pin', 'Photo essay + oral history transcript', 'Illustrated story + cultural art'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A Living Community Atlas — a collection of oral histories, photographs, artwork, and maps documenting the stories and cultural significance of places in the neighborhood. Published as a physical book and gifted to the community.',
    format_options: ['Printed atlas book + launch event', 'Interactive digital atlas + community event', 'Printed atlas + audio companion (QR codes linking to recorded interviews)'],
    audience: 'Community interviewees, families, school library, local historical society, and neighborhood organizations',
    presentation_format: 'Community atlas launch event with student presentations, interviewee honors, and atlas distribution',
    quality_criteria: [
      'Atlas entries preserve interviewees\' voices with authenticity and respect',
      'Stories are connected to specific places through maps and photographs',
      'Visual art and design reflect the cultural richness of the community',
      'Atlas represents the diversity of the community — multiple voices, cultures, and perspectives',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Research how other communities have created living atlases or oral history projects. Compare the community\'s story map to historical records and analyze whose stories are missing from official histories. Create a companion podcast series with extended interviews. Develop a proposal for permanent community story markers.',
    supporting: 'Provide interview question banks. Pair students for interviews. Use photo-based story prompts. Offer atlas entry templates with sentence starters. Allow audio or video entries alongside written ones. Simplify mapping with pre-made base maps.',
    ell_accommodations: 'Conduct interviews in home languages — these stories are gifts in any language. Provide bilingual atlas entries celebrating multilingual communities. Use visual storytelling for students building English proficiency. Partner bilingual students as interpreter-interviewers.',
    accessibility_notes: 'Ensure walking routes are accessible. Provide digital mapping alternatives. Allow audio/video atlas entries for students with writing challenges. Offer virtual interview options. Create tactile atlas elements for visually impaired students.',
  }

  const resources: TemplateResource[] = [
    { title: 'StoryCorps Interview Guide', type: 'link', url: 'https://storycorps.org/participate/great-questions/', notes: 'Excellent open-ended questions for oral history interviews, adaptable for place-based focus.' },
    { title: 'Native Land Digital', type: 'link', url: 'https://native-land.ca', notes: 'Starting point for understanding whose ancestral land the school and community occupy.' },
    { title: 'Google My Maps', type: 'tool', url: 'https://www.google.com/maps/d/', notes: 'Free tool for creating custom interactive maps with pins, photos, and descriptions.' },
    { title: 'Oral History Consent Form', type: 'printable', url: null, notes: 'Age-appropriate consent form for interviewees, available in multiple languages.' },
    { title: 'Atlas Entry Template', type: 'printable', url: null, notes: 'Structured template: place name, location, story summary, key quotes, photos, and cultural significance.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Voices of Our Place: A Living Community Atlas',
    description: 'Students explore their neighborhood, conduct oral history interviews with community members, and create a Living Community Atlas — a published collection of maps, stories, photographs, and art documenting the cultural significance of local places.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'upper_elementary',
    subject_area: ['Social Studies', 'ELA', 'Art'],
    estimated_duration_days: 22,
    driving_question: 'What stories, memories, and meanings live in the places around us, and how can we make sure they are never lost?',
    essential_understandings: [
      'Every place holds layers of human story — and those stories shape community identity.',
      'Oral history is a powerful way to preserve knowledge that written records often miss.',
      'When we listen to the stories of a place, we learn to see our community with new eyes and deeper respect.',
    ],
    authenticity_hook: 'Students produce a real, published atlas that is gifted back to the community. Interviewees see their stories honored in print. The atlas becomes a lasting community resource that can grow over time as new stories are collected.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Respectful Representation Review: peer pairs read each other\'s atlas entries and ask — Does this entry honor the person who shared their story? Is the interviewee\'s voice present? Would the interviewee feel proud to see this entry? Revise based on this lens.',
    scaffolding_notes: 'Start with the personal place maps to build emotional investment. Practice interview skills extensively before community interviews. Model story crafting with a shared class example. Discuss ethics of representation throughout — we are scribes, not authors, of other people\'s stories.',
    differentiation,
    materials_and_resources: resources,
    tags: ['place-based', 'culturally-immersive', 'oral-history', 'community-mapping', 'atlas', 'storytelling', 'upper-elementary'],
    status: 'published',
  }
}

// ============================================================
// 8. "Rhythm of Our People: Music, Movement, and Memory"
//    Place-based · Culturally immersive
// ============================================================

function rhythmOfOurPeople(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Listen & Share',
      description: 'Build a musical autobiography. Students explore the music that matters in their families and cultures, sharing sounds and stories in small groups.',
      duration_days: 3,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Musical Autobiography', description: 'Students bring a song that matters to their family or culture. Share in small groups: What is this song? When do you hear it? What does it mean? What feelings does it carry?', activity_type: 'presentation', is_required: true, estimated_minutes: 60, resources: ['Audio playback device', 'Musical autobiography template', 'Sharing norms poster'], educator_notes: 'Create a safe, respectful space. Music is deeply personal and cultural. Allow students to share recordings, sing, or describe a song. Some may share lullabies, hymns, folk songs, pop songs — all are valid.' },
        { id: uid(), title: 'Sound Walk', description: 'Walk through the school and neighborhood listening intentionally. What sounds define this place? Traffic, birdsong, church bells, call to prayer, vendors, children playing. Record sounds.', activity_type: 'field_work', is_required: true, estimated_minutes: 40, resources: ['Recording devices', 'Sound journal template'], educator_notes: 'Walk in silence. Pause at different spots to listen for 60 seconds. Record both natural and human-made sounds. These become raw material for composition later.' },
        { id: uid(), title: 'Our Classroom Soundtrack', description: 'Compile a collaborative playlist of culturally significant songs from students\' families. Discuss patterns: What emotions do our songs carry? What stories do they tell? What traditions do they honor?', activity_type: 'collaboration', is_required: true, estimated_minutes: 30, resources: ['Collaborative playlist tool', 'Pattern observation worksheet'], educator_notes: 'This playlist becomes a living document throughout the project. Add to it as students discover more music from their families and community.' },
      ],
      reflection_prompts: [
        'What does your family\'s music tell the world about who you are?',
        'What sounds define the place where you live?',
        'How does music carry things that words alone cannot?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Discover & Research',
      description: 'Investigate the musical traditions of the community through interviews with family musicians, community performers, and cultural practitioners.',
      duration_days: 7,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Family Music Interview', description: 'Interview a family member about their musical traditions: songs from their childhood, instruments played, music at celebrations, lullabies, work songs, or worship music. Record or take detailed notes.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Interview guide with music-focused questions', 'Recording device', 'Thank-you card supplies'], educator_notes: 'Some families have rich musical traditions; others connect to music differently. Broaden the definition: humming while cooking, clapping games, whistling, drumming on tables. All count.' },
        { id: uid(), title: 'Community Musician Visit', description: 'Invite a local musician, choir director, DJ, or cultural performer to share their craft and discuss how music connects to community and culture.', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: ['Guest musician invitation', 'Performance space', 'Student question cards'], educator_notes: 'Seek musicians who represent the cultural diversity of your classroom. Compensate performers when possible. Ask them to teach one simple musical element students can learn.' },
        { id: uid(), title: 'Music & History Research', description: 'Research the musical traditions connected to students\' cultures: origins, instruments, rhythms, and the stories music carried (resistance songs, migration songs, celebration songs, prayer songs).', activity_type: 'investigation', is_required: true, estimated_minutes: 60, resources: ['Research template', 'Cultural music listening stations', 'Library resources'], educator_notes: 'Connect music to historical context: Why did this music develop? What was happening to these people? How did music help them survive, resist, celebrate, or remember? Use curated playlists from diverse traditions.' },
        { id: uid(), title: 'Musical Elements Study', description: 'Learn the musical building blocks: rhythm, melody, dynamics, tempo, texture. Analyze how these elements work in the songs from students\' cultures.', activity_type: 'skill_building', is_required: true, estimated_minutes: 45, resources: ['Musical elements chart', 'Listening analysis worksheet', 'Instruments or body percussion'], educator_notes: 'Connect with the music teacher. Use songs from the class playlist as analysis texts. Students analyze their own cultural music through a musical lens.' },
      ],
      reflection_prompts: [
        'What did your family member\'s music interview reveal that you didn\'t know?',
        'How has music been used by your culture to carry important messages or memories?',
        'What musical elements are common across different cultures in our classroom?',
      ],
      checkpoint: {
        title: 'Music Research Review',
        description: 'Educator reviews interview notes, research, and musical analysis.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['Family music interview completed with cultural context', 'Musical tradition researched with historical connections', 'Musical elements identified in cultural music examples'],
      },
    },
    {
      id: p3Id,
      title: 'Compose & Create',
      description: 'Create original musical compositions and performances that draw from family and cultural traditions, the sounds of the community, and what students have learned.',
      duration_days: 7,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Composition Workshop', description: 'Create an original piece of music that weaves together elements from personal/cultural traditions with the sounds of the community. Can be a song, instrumental piece, soundscape, spoken word with music, or rhythmic composition.', activity_type: 'creation', is_required: true, estimated_minutes: 150, resources: ['Instruments (classroom and student-brought)', 'Recording equipment', 'Digital music tools (GarageBand, Soundtrap)', 'Composition planning worksheet'], educator_notes: 'Musical literacy is NOT required. Students can compose using voice, body percussion, found objects, or digital tools. The goal is authentic expression, not technical perfection. Collaborate with the music teacher.' },
        { id: uid(), title: 'Story & Context Writing', description: 'Write the story behind the composition: What cultural traditions inspired it? What sounds or memories does it carry? What does it mean to you? This becomes the program note for the concert.', activity_type: 'creation', is_required: true, estimated_minutes: 45, resources: ['Program note template', 'Mentor program notes'], educator_notes: 'These program notes are the bridge between the music and the audience\'s understanding. They should be personal, cultural, and honest.' },
        { id: uid(), title: 'Rehearsal & Peer Feedback', description: 'Perform works-in-progress for peers. Give feedback using "I heard / I felt / I wondered" protocol. Revise compositions based on peer and educator feedback.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Peer feedback protocol cards', 'Performance space'], educator_notes: 'Create a supportive performance environment. Applaud every piece. Feedback should focus on emotional impact and cultural expression, not technical skill.' },
      ],
      reflection_prompts: [
        'How does your composition connect to your family\'s musical traditions?',
        'What was the hardest creative decision you made?',
        'How did peer feedback change your piece?',
      ],
      checkpoint: {
        title: 'Peer Performance Review',
        description: 'Peer feedback on compositions using "I heard / I felt / I wondered" protocol.',
        assessment_type: 'peer_review',
        competency_ids: [],
        criteria: ['Composition draws from personal/cultural musical traditions', 'Piece communicates emotion or meaning', 'Program note explains the cultural and personal inspiration', 'Peer feedback received and considered'],
      },
    },
    {
      id: p4Id,
      title: 'Perform & Celebrate',
      description: 'Community concert where students perform original compositions for families and community. A celebration of the musical diversity and cultural richness of the community.',
      duration_days: 3,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Concert Preparation', description: 'Finalize compositions, design the concert program with cultural program notes, rehearse in the performance space, and prepare the stage and seating.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Performance space', 'Concert program template', 'Stage setup materials'], educator_notes: 'Let students co-design the concert flow. Include moments for the audience to participate — a community sing-along or clapping rhythm. Make programs multilingual.' },
        { id: uid(), title: 'Community Concert', description: 'Perform for families and community members. Each piece is introduced with its cultural context. Family musicians are invited to perform alongside students or contribute a piece.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Sound system', 'Programs', 'Guest seating', 'Recording equipment', 'Refreshments'], educator_notes: 'This should feel like a cultural celebration, not a formal recital. Invite family musicians to contribute. Create space for spontaneous musical sharing. Record the concert for families.' },
        { id: uid(), title: 'Listening Circle & Gratitude', description: 'Post-concert reflection circle. Listen to recordings of the concert. Discuss: What did we learn about each other through music? Write thank-you notes to interviewees and guest musicians.', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Concert recordings', 'Thank-you cards', 'Talking piece'], educator_notes: 'This closing matters. Music opens emotional doors. Give students time to process. Some may want to share what the project meant to them personally.' },
      ],
      reflection_prompts: [
        'What did it feel like to share your music with the community?',
        'What musical tradition from a classmate\'s culture would you like to learn more about?',
        'How does music build bridges between people from different cultures?',
      ],
      checkpoint: {
        title: 'Concert Self-Assessment',
        description: 'Individual reflection on the full musical journey from listening to performing.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Composition reflects genuine cultural and personal inspiration', 'Performance communicates to the audience', 'Student can articulate how music connects culture, memory, and community'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p2Id, description: 'Choose which musical tradition to research deeply.', choice_type: 'topic_selection', options: ['A family lullaby or childhood song', 'Music from celebrations or ceremonies', 'Work songs, field songs, or labor music', 'Music of resistance or social change', 'Worship or spiritual music', 'Dance and movement music'] },
    { phase_id: p3Id, description: 'Choose the format for your original composition.', choice_type: 'product_format', options: ['Song with lyrics and melody', 'Instrumental piece', 'Community soundscape (layered sounds)', 'Spoken word with musical accompaniment', 'Rhythm and percussion piece', 'Digital composition or remix'] },
    { phase_id: p4Id, description: 'Choose how to present at the concert.', choice_type: 'presentation_style', options: ['Live performance (solo or group)', 'Recorded piece with live introduction', 'Performance with visual art backdrop', 'Interactive piece (audience participates)'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'An original musical composition inspired by family and cultural traditions, performed at a community concert that celebrates the musical diversity of the neighborhood.',
    format_options: ['Live concert performance + printed program', 'Concert + recorded album of class compositions', 'Concert + documentary video of the musical journey'],
    audience: 'Families, community musicians, school community, and cultural organizations',
    presentation_format: 'Community concert with cultural program notes and family musician participation',
    quality_criteria: [
      'Composition authentically draws from personal and cultural musical traditions',
      'Program note explains the cultural context and personal meaning behind the piece',
      'Performance communicates emotion and meaning to the audience',
      'Student demonstrates understanding of how music carries cultural memory',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Research the musicology of a cultural tradition in depth. Compose a multi-movement suite that traces a cultural journey. Create a mini-documentary about music in the community. Analyze how musical traditions have blended and evolved through migration and cultural exchange.',
    supporting: 'Provide rhythm templates and melodic patterns to build from. Use body percussion and found objects for students without instrumental experience. Offer recording and layering tools that don\'t require live performance. Pair students for compositions. Allow group performances.',
    ell_accommodations: 'Songs in home languages are celebrated and encouraged. Provide music vocabulary in students\' languages. Allow spoken introductions in home language with English summary. Partner with family members who can help translate musical concepts and cultural context.',
    accessibility_notes: 'Provide adaptive instruments and digital tools for students with motor challenges. Offer visual or tactile rhythm cues for deaf/hard-of-hearing students. Allow pre-recorded performances. Ensure concert space is accessible. Provide sensory-friendly concert options.',
  }

  const resources: TemplateResource[] = [
    { title: 'Soundtrap by Spotify', type: 'tool', url: 'https://www.soundtrap.com', notes: 'Free collaborative online music studio — great for students who want to compose digitally.' },
    { title: 'Musical Autobiography Template', type: 'printable', url: null, notes: 'Guided worksheet: songs of my family, sounds of my place, music that makes me feel.' },
    { title: 'Music Interview Guide', type: 'printable', url: null, notes: 'Interview questions focused on family musical traditions, memories, and cultural significance.' },
    { title: 'I Heard / I Felt / I Wondered Protocol', type: 'printable', url: null, notes: 'Peer feedback protocol for musical compositions: what sounds did you hear, what did the music make you feel, what do you wonder about the piece?' },
    { title: 'Concert Program Template', type: 'printable', url: null, notes: 'Bilingual program template with space for cultural program notes and performer biographies.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Rhythm of Our People: Music, Movement, and Memory',
    description: 'Students explore the musical traditions of their families and community, interview family musicians and cultural practitioners, compose original music inspired by their heritage, and perform at a community concert celebrating cultural diversity through sound.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'mixed',
    subject_area: ['Music', 'Social Studies', 'ELA'],
    estimated_duration_days: 20,
    driving_question: 'How does the music of our families and community carry the stories, struggles, and celebrations of who we are?',
    essential_understandings: [
      'Music is a universal human practice that carries cultural identity, memory, and emotion across generations.',
      'Every musical tradition has roots in the lived experience of a people and a place.',
      'When we share our music, we share the deepest parts of who we are — building understanding across difference.',
    ],
    authenticity_hook: 'Families and community musicians are central to every phase — as interviewees, guest performers, and audience. The concert is a genuine cultural celebration, not a school performance. Students create real music, not exercises.',
    final_product: finalProduct,
    dok_level: 3,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'I Heard / I Felt / I Wondered: Peers listen to compositions and share what sounds they heard, what emotions the music evoked, and what questions it raised. Feedback focuses on emotional impact and cultural authenticity, not technical perfection.',
    scaffolding_notes: 'Start with listening and sharing — build trust before asking students to create. Front-load the musical autobiography so every student feels their tradition is valued. Provide musical building blocks (rhythm patterns, simple melodies) for students without composition experience. The goal is expression, not virtuosity.',
    differentiation,
    materials_and_resources: resources,
    tags: ['place-based', 'culturally-immersive', 'music', 'oral-history', 'performance', 'community', 'mixed-grades'],
    status: 'published',
  }
}

// ============================================================
// 9. "Building Together: Designing Spaces Our Community Needs"
//    Place-based · Culturally immersive
// ============================================================

function buildingTogether(schoolId: string, createdBy: string): AssignmentTemplateInsert {
  const p1Id = uid(), p2Id = uid(), p3Id = uid(), p4Id = uid()

  const phases: ProjectPhase[] = [
    {
      id: p1Id,
      title: 'Explore & Listen',
      description: 'Walk the community to observe gathering spaces — formal and informal. Listen to community members about what spaces they need and how they gather.',
      duration_days: 4,
      dok_level: 2,
      activities: [
        { id: uid(), title: 'Gathering Space Walk', description: 'Walk the neighborhood identifying where people gather: parks, stoops, parking lots, community centers, places of worship, markets, playgrounds. Photograph and categorize each space.', activity_type: 'field_work', is_required: true, estimated_minutes: 75, resources: ['Walking route map', 'Camera', 'Gathering space survey form', 'Clipboards'], educator_notes: 'Look beyond formal spaces. Where do people ACTUALLY gather? Under a tree? On a corner? At a laundromat? The informal spaces tell us as much as the planned ones.' },
        { id: uid(), title: 'Community Listening Session', description: 'Host a listening session where community members, families, and students discuss: What spaces does our community need? What kind of gathering place is missing? How do different cultures in our community gather?', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Listening session facilitation guide', 'Note-taking templates', 'Refreshments', 'Multilingual facilitation support'], educator_notes: 'This must be a genuine listening exercise, not a presentation. Invite diverse voices. Provide translation support. Record themes, not just individual ideas. Ask: How do you gather in your culture? What makes a space feel welcoming?' },
        { id: uid(), title: 'Cultural Gathering Research', description: 'Students research how their own cultures gather: What are traditional gathering spaces like? How are they arranged? What makes them feel like home? Draw or photograph examples.', activity_type: 'investigation', is_required: true, estimated_minutes: 45, resources: ['Cultural gathering space research guide', 'Drawing supplies', 'Family interview prompts'], educator_notes: 'A Mexican plaza, a Japanese garden, an African palaver tree, an Italian piazza, a Native American gathering circle — every culture has spatial wisdom about how people come together. This knowledge informs the design.' },
      ],
      reflection_prompts: [
        'What gathering space in your life feels most welcoming? Why?',
        'What did community members say they need most?',
        'How does your culture\'s way of gathering influence what kind of space you would design?',
      ],
      checkpoint: null,
    },
    {
      id: p2Id,
      title: 'Measure & Analyze',
      description: 'Apply math and spatial reasoning to analyze existing community spaces. Conduct needs assessments and site analysis for the design project.',
      duration_days: 6,
      dok_level: 3,
      activities: [
        { id: uid(), title: 'Site Analysis & Measurement', description: 'Select a potential site for the community space design. Measure dimensions, map the area to scale, note sun exposure, drainage, access points, and existing features.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Measuring tapes', 'Graph paper', 'Compasses', 'Site analysis worksheet'], educator_notes: 'Math comes alive here: area, perimeter, scale, proportion. If a real site isn\'t available, use a hypothetical lot with real dimensions. Teach scale drawing as a practical skill.' },
        { id: uid(), title: 'Needs Assessment Survey', description: 'Design and conduct a community survey: What activities should the space support? Who will use it? When? What cultural practices need to be accommodated? Analyze survey data.', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: ['Survey design template', 'Survey distribution plan', 'Data analysis worksheets'], educator_notes: 'Surveys should be available in the languages of the community. Include visual prompts (photos of different gathering spaces). Help students analyze data using graphs and percentages.' },
        { id: uid(), title: 'Precedent Study', description: 'Research inspiring examples of community spaces that honor cultural diversity: culturally-designed parks, community gardens with cultural zones, multicultural community centers.', activity_type: 'investigation', is_required: true, estimated_minutes: 60, resources: ['Precedent study examples', 'Analysis template', 'Internet access'], educator_notes: 'Find examples where culture influenced design: Japanese zen gardens in urban parks, African-inspired gathering circles, indigenous outdoor classrooms. Show students that culture and design are deeply connected.' },
        { id: uid(), title: 'Budget & Materials Math', description: 'Research costs of materials and features. Create a realistic budget for the design. Practice operations with decimals, percentages, and area calculations.', activity_type: 'skill_building', is_required: true, estimated_minutes: 60, resources: ['Material cost sheets', 'Budget template', 'Calculator'], educator_notes: 'Real-world math: calculating costs per square foot, budgeting with constraints, comparing material options. Connect math to meaningful decision-making.' },
      ],
      reflection_prompts: [
        'What did the survey data reveal about what our community values in a gathering space?',
        'How did the site analysis change what you think is possible?',
        'What cultural design elements from your research inspired you most?',
      ],
      checkpoint: {
        title: 'Needs Assessment & Site Analysis Review',
        description: 'Educator reviews survey data analysis, site measurements, and precedent research.',
        assessment_type: 'educator_check',
        competency_ids: [],
        criteria: ['Site measured and drawn to scale', 'Community survey conducted and data analyzed', 'At least 2 precedent studies reviewed', 'Budget framework established with realistic estimates'],
      },
    },
    {
      id: p3Id,
      title: 'Design & Model',
      description: 'Design the community space integrating community input, cultural knowledge, math, and environmental considerations. Build physical or digital models.',
      duration_days: 7,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Design Charrette', description: 'Collaborative design session: teams develop design concepts that respond to community needs, honor cultural gathering practices, fit the site, and stay within budget. Rapid sketching and idea sharing.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Large paper', 'Markers', 'Site maps', 'Needs assessment summary', 'Cultural design inspiration board'], educator_notes: 'A charrette is an intensive collaborative design session. Set a time limit. Encourage wild ideas first, then refine. Every design must include at least one culturally-inspired element and respond to at least one community-identified need.' },
        { id: uid(), title: 'Scale Model Construction', description: 'Build a physical scale model of the design using cardboard, craft materials, or digital 3D tools. Include landscaping, seating, cultural elements, signage, and accessibility features.', activity_type: 'creation', is_required: true, estimated_minutes: 180, resources: ['Cardboard', 'Craft supplies', 'Hot glue guns', 'Miniature materials', 'Scale rulers', '3D modeling software (optional)'], educator_notes: 'Scale models make design tangible. Teach scale conversion. Emphasize that the model must communicate the design to someone who wasn\'t in the design process. Include signage in community languages.' },
        { id: uid(), title: 'Design Review with Community Panel', description: 'Present designs to a panel of community members, families, and local professionals (architect, urban planner, parks department staff). Receive feedback and revise.', activity_type: 'collaboration', is_required: true, estimated_minutes: 60, resources: ['Presentation setup', 'Feedback forms', 'Panel invitation letters'], educator_notes: 'This is the authentic critique. Community members evaluate whether the design truly serves their needs. Invite someone from parks & rec, a local architect, or community organizer. Their feedback must genuinely influence the final design.' },
      ],
      reflection_prompts: [
        'How does your design honor the cultural diversity of the community?',
        'What trade-offs did you have to make because of budget or space constraints?',
        'What feedback from the community panel changed your design?',
      ],
      checkpoint: {
        title: 'Community Design Panel',
        description: 'Community members and professionals review design models and provide feedback.',
        assessment_type: 'group_critique',
        competency_ids: [],
        criteria: ['Design responds to identified community needs', 'Cultural gathering practices are reflected in the design', 'Model is built to scale with accurate measurements', 'Community panel feedback incorporated into revisions'],
      },
    },
    {
      id: p4Id,
      title: 'Present & Propose',
      description: 'Present final designs to community stakeholders in a formal proposal format. Advocate for the community space.',
      duration_days: 3,
      dok_level: 4,
      activities: [
        { id: uid(), title: 'Proposal Writing', description: 'Write a formal design proposal: problem statement, community needs, design description, budget, cultural significance, and maintenance plan. Include technical drawings and model photos.', activity_type: 'creation', is_required: true, estimated_minutes: 90, resources: ['Proposal template', 'Model photos', 'Budget summary', 'Design drawings'], educator_notes: 'Model a strong proposal. Include a section on cultural significance — why this design matters for this specific community. Make the proposal professional enough to submit to a real decision-maker.' },
        { id: uid(), title: 'Community Presentation', description: 'Present final designs and proposals to community stakeholders: school board, city council representative, parks department, neighborhood association, or community development organization.', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: ['Presentation setup', 'Scale models', 'Printed proposals', 'Community invitations'], educator_notes: 'Invite real decision-makers. Even if the project isn\'t built as designed, the experience of advocating for community needs to real authorities is transformative. Help students prepare for questions.' },
        { id: uid(), title: 'Reflection & Next Steps', description: 'Reflect on the design process and community engagement. Discuss: What would it take to make this real? How can we continue advocating for the spaces our community needs?', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: ['Reflection journal', 'Next steps planning template'], educator_notes: 'Some school communities have successfully built student-designed spaces. Even if this one doesn\'t get built, the advocacy skills and community engagement are the real learning. Connect students to ongoing community planning processes.' },
      ],
      reflection_prompts: [
        'What did you learn about design as a tool for community change?',
        'How did math help you make better design decisions?',
        'What does it mean to design a space that honors who people are and how they gather?',
      ],
      checkpoint: {
        title: 'Proposal Self-Assessment',
        description: 'Individual assessment of design thinking, math application, and community engagement.',
        assessment_type: 'self_assessment',
        competency_ids: [],
        criteria: ['Proposal is professional and persuasive', 'Design integrates math, culture, and community input', 'Student can articulate how the design serves the community', 'Student demonstrates growth in design thinking'],
      },
    },
  ]

  const choicePoints: ChoicePoint[] = [
    { phase_id: p1Id, description: 'Choose which type of community space to investigate.', choice_type: 'topic_selection', options: ['Outdoor gathering/park space', 'Community garden with cultural zones', 'Youth and family center', 'Outdoor classroom or learning space', 'Multicultural marketplace or plaza'] },
    { phase_id: p3Id, description: 'Choose how to build the design model.', choice_type: 'product_format', options: ['Physical cardboard/craft scale model', 'Digital 3D model (SketchUp/Tinkercad)', 'Detailed architectural drawings + model', 'Mixed media model with landscape elements'] },
    { phase_id: p4Id, description: 'Choose the presentation approach.', choice_type: 'presentation_style', options: ['Formal proposal presentation to panel', 'Design exhibition with model walkthrough', 'Video proposal documentary', 'Interactive community design fair'] },
  ]

  const finalProduct: FinalProduct = {
    description: 'A scale model and written design proposal for a community gathering space that integrates community needs, cultural gathering practices, mathematical precision, and environmental design — presented to real community stakeholders.',
    format_options: ['Physical model + written proposal + presentation', 'Digital 3D model + proposal + video walkthrough', 'Physical model + proposal + design exhibition'],
    audience: 'Community stakeholders: school board, city council, parks department, neighborhood association, and families',
    presentation_format: 'Formal design proposal presentation to community stakeholders with scale models and written proposals',
    quality_criteria: [
      'Design directly responds to community-identified needs documented through surveys and listening sessions',
      'Cultural gathering practices from students\' communities are authentically reflected in the design',
      'Model is built to scale with accurate measurements and realistic budget',
      'Proposal is professional, persuasive, and includes a clear maintenance plan',
    ],
  }

  const differentiation: DifferentiationGuide = {
    extending: 'Research universal design principles and ensure the space is fully accessible. Develop a phased implementation plan with cost estimates for each phase. Create a sustainability plan addressing materials, water use, and environmental impact. Compare community design processes across different cities and cultures.',
    supporting: 'Provide pre-measured site maps and simplified budget templates. Offer scale model building kits with guided instructions. Use visual survey tools instead of written surveys. Allow team roles that match student strengths (measurer, artist, builder, writer). Simplify the proposal template.',
    ell_accommodations: 'Conduct community surveys in families\' languages. Allow design presentations with visual models as the primary communication tool. Provide bilingual math vocabulary. Celebrate designs that incorporate spatial concepts from students\' home cultures. Use visual precedent studies.',
    accessibility_notes: 'Ensure site walks are accessible. Provide digital design tools as alternatives to physical model building. Allow alternative presentation formats. Incorporate universal design as a project requirement — the designed space must be accessible to people of all abilities.',
  }

  const resources: TemplateResource[] = [
    { title: 'Tinkercad', type: 'tool', url: 'https://www.tinkercad.com', notes: 'Free browser-based 3D design tool suitable for students. Great for digital scale models.' },
    { title: 'Community Listening Session Guide', type: 'printable', url: null, notes: 'Facilitation guide for hosting a respectful, inclusive community input session with multilingual support.' },
    { title: 'Scale Drawing Template', type: 'printable', url: null, notes: 'Graph paper with scale conversion chart and measurement recording sheet.' },
    { title: 'Design Proposal Template', type: 'printable', url: null, notes: 'Structured template: community need, design concept, cultural significance, budget, and maintenance plan.' },
    { title: 'If You Come to Earth (Sophie Blackall)', type: 'book', url: null, notes: 'Beautiful picture book showing the diversity of human homes and gathering places around the world. Great for early inspiration.' },
  ]

  return {
    school_id: schoolId,
    created_by: createdBy,
    title: 'Building Together: Designing Spaces Our Community Needs',
    description: 'Students survey community needs, study how different cultures gather, apply math and spatial reasoning, and design a culturally responsive community space — presenting scale models and proposals to real community stakeholders.',
    assignment_type: 'class',
    competency_ids: [],
    skill_ids: [],
    is_shared: true,
    template_data: {},
    grade_band: 'middle_school',
    subject_area: ['Math', 'Social Studies', 'Art'],
    estimated_duration_days: 20,
    driving_question: 'What spaces does our community need, and how can we design them so they honor who we are and how we gather?',
    essential_understandings: [
      'The design of physical spaces reflects the values and cultural practices of the people who use them.',
      'Community design is most powerful when it centers the voices of the people it serves — especially those historically excluded from planning processes.',
      'Math, art, and cultural knowledge all contribute to creating spaces that are functional, beautiful, and meaningful.',
    ],
    authenticity_hook: 'Community members drive the design through real listening sessions and surveys. Students present to real stakeholders (school board, city officials, parks department). Some student-designed projects have been built. The proposal format is professionally authentic.',
    final_product: finalProduct,
    dok_level: 4,
    phases,
    choice_points: choicePoints,
    critique_protocol: 'Community Design Review Panel: community members, families, and a local design professional review student designs for responsiveness to community needs, cultural authenticity, feasibility, and accessibility. Students revise based on panel feedback.',
    scaffolding_notes: 'Start with the gathering space walk to build observational skills. The community listening session must happen early to ensure genuine community voice. Front-load scale drawing and measurement skills. Use precedent studies to inspire culturally-informed design. The community panel critique is essential — designs must respond to real input.',
    differentiation,
    materials_and_resources: resources,
    tags: ['place-based', 'culturally-immersive', 'math', 'design', 'community-planning', 'architecture', 'middle-school'],
    status: 'published',
  }
}

// ============================================================
// Export
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

/**
 * Returns place-based, culturally immersive project templates.
 * These are designed to work across diverse cultural contexts while
 * deeply honoring students' communities, traditions, and places.
 */
export function getPlaceBasedTemplates(
  schoolId: string,
  createdBy: string
): AssignmentTemplateInsert[] {
  return [
    ourRootsOurTable(schoolId, createdBy),
    guardiansOfThisPlace(schoolId, createdBy),
    voicesOfOurPlace(schoolId, createdBy),
    rhythmOfOurPeople(schoolId, createdBy),
    buildingTogether(schoolId, createdBy),
  ]
}

/**
 * Returns ALL seed templates (generic + place-based).
 */
export function getAllSeedTemplates(
  schoolId: string,
  createdBy: string
): AssignmentTemplateInsert[] {
  return [
    ...getSeedTemplates(schoolId, createdBy),
    ...getPlaceBasedTemplates(schoolId, createdBy),
  ]
}
