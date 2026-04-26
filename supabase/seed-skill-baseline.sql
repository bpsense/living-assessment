-- seed-skill-baseline.sql
--
-- Companion to scripts/seed-skill-baseline.ts. Run this in psql / the
-- Supabase SQL editor when the TypeScript runner can't be used.
--
-- Behavior matches the TS script:
--   * Resolves the default Learner Profile and its 8 domains by name.
--   * Aborts loudly if any expected domain is missing.
--   * Deletes existing skills attached to those 8 domain ids (school-owned
--     skills tagged to other profiles are left untouched).
--   * Inserts ~154 baseline skills in a single statement, with school_id NULL.
--
-- Run inside a transaction so a failed lookup rolls back cleanly.

begin;

-- 1. Resolve the default profile and its domains; bail if anything is missing.
do $$
declare
  v_profile_id uuid;
  v_missing text;
begin
  select id into v_profile_id
    from learner_profiles
    where is_default = true
    limit 1;

  if v_profile_id is null then
    raise exception 'No default learner_profile found (is_default = true).';
  end if;

  -- Verify each expected domain name exists on the default profile.
  for v_missing in
    select unnest(array[
      'Language & Communication',
      'Mathematical Thinking',
      'Scientific & Environmental Inquiry',
      'Creative Expression & Making',
      'Inner Self & Well Being',
      'Physical Wellbeing & Movement',
      'Collaboration & Relational Skills',
      'Global Citizenship & Contribution'
    ]) as expected
    where expected not in (
      select name from learner_profile_domains where profile_id = v_profile_id
    )
  loop
    raise exception 'Default learner profile is missing expected domain: %', v_missing;
  end loop;
end $$;

-- 2. Delete existing skills attached to the default profile's 8 domains.
with default_profile as (
  select id from learner_profiles where is_default = true limit 1
),
default_domain_ids as (
  select d.id
  from learner_profile_domains d
  join default_profile p on p.id = d.profile_id
)
delete from skills
 where domain_id in (select id from default_domain_ids);

-- 3. Insert baseline skills. The CTE resolves each row's domain name to a
--    UUID against the default profile's domains.
with default_profile as (
  select id from learner_profiles where is_default = true limit 1
),
domains as (
  select d.id, d.name
  from learner_profile_domains d
  join default_profile p on p.id = d.profile_id
),
incoming(domain_name, name, description, age_band_start, age_band_end, source_reference) as (
  values
  ('Language & Communication', 'Recognize letters and their sounds', 'Identify all uppercase and lowercase letters. Associate each letter with its primary sound (phonemic awareness).', 4, 5, 'CCSS-ELA RF.K / EYFS'),
  ('Language & Communication', 'Speak clearly in complete sentences', 'Express ideas in complete sentences with appropriate volume and eye contact. Take turns in conversation.', 4, 5, 'CCSS-ELA SL.K / CDC'),
  ('Language & Communication', 'Listen and respond to stories and instructions', 'Listen attentively to read-alouds and short instructions. Retell key events or follow two-step directions.', 4, 5, 'CCSS-ELA SL.K / CDC'),
  ('Language & Communication', 'Write letters and simple words', 'Write own name and familiar words. Represent ideas through drawing combined with emergent writing.', 4, 5, 'CCSS-ELA W.K / EYFS'),
  ('Language & Communication', 'Understand print concepts', 'Understand that print carries meaning, how to hold a book, directionality (left to right, top to bottom), and that words are separated by spaces.', 4, 5, 'CCSS-ELA RF.K'),
  ('Language & Communication', 'Decode and read simple texts fluently', 'Apply phonics knowledge to decode unfamiliar words. Read grade-level texts with sufficient accuracy and fluency to support comprehension.', 6, 7, 'CCSS-ELA RF.1 / RF.2'),
  ('Language & Communication', 'Comprehend and retell narrative texts', 'Identify key details, characters, setting, and problem/solution in stories. Retell using beginning, middle, and end.', 6, 7, 'CCSS-ELA RL.1 / RL.2'),
  ('Language & Communication', 'Write sentences with correct mechanics', 'Write complete sentences with capitalization and end punctuation. Use spaces between words consistently.', 6, 7, 'CCSS-ELA W.1 / L.1'),
  ('Language & Communication', 'Ask and answer questions about a text', 'Ask and answer questions (who, what, where, when, why, how) about key details in a text. Use evidence from the text.', 6, 7, 'CCSS-ELA RI.1 / RL.1'),
  ('Language & Communication', 'Distinguish facts from opinions', 'Identify statements as factual claims or opinions. Understand that facts can be verified and opinions reflect perspectives.', 6, 7, 'CCSS-ELA RI.2'),
  ('Language & Communication', 'Read and understand informational texts', 'Identify main idea and supporting details in nonfiction. Use text features (headings, captions, glossary).', 8, 9, 'CCSS-ELA RI.3 / RI.4'),
  ('Language & Communication', 'Write structured paragraphs with a clear purpose', 'Write opinion, informative, and narrative paragraphs with a topic sentence, supporting details, and a conclusion.', 8, 9, 'CCSS-ELA W.3 / W.4'),
  ('Language & Communication', 'Use context clues to determine word meaning', 'Use context and word structure (prefixes, suffixes, roots) to determine the meaning of unfamiliar words.', 8, 9, 'CCSS-ELA L.3 / L.4'),
  ('Language & Communication', 'Compare and contrast multiple texts on a topic', 'Explain the similarities and differences between two texts on the same topic. Identify how different authors treat the same information.', 8, 9, 'CCSS-ELA RI.3 / RL.3'),
  ('Language & Communication', 'Deliver a short prepared presentation', 'Plan and deliver a short oral presentation on a chosen topic. Use appropriate pacing, volume, and visual support.', 8, 9, 'CCSS-ELA SL.4 / SL.5'),
  ('Language & Communication', 'Construct and critique written arguments', 'Build a written argument with a clear claim and supporting evidence. Identify weaknesses in own and others'' arguments.', 8, 9, 'CCSS-ELA W.1 / W.3'),
  ('Language & Communication', 'Write multi-paragraph essays with a thesis', 'Write well-structured essays with an introduction, body paragraphs, and conclusion. State and develop a clear claim.', 10, 11, 'CCSS-ELA W.5 / W.6'),
  ('Language & Communication', 'Cite evidence from texts to support analysis', 'Quote or paraphrase text evidence to support interpretation or argument. Distinguish evidence from opinion.', 10, 11, 'CCSS-ELA RI.5 / RI.6'),
  ('Language & Communication', 'Identify author''s purpose and point of view', 'Analyze how an author''s purpose, perspective, or bias influences the content and structure of a text.', 10, 11, 'CCSS-ELA RI.6 / RL.6'),
  ('Language & Communication', 'Conduct research and synthesize information', 'Gather information from multiple sources, evaluate source credibility, and synthesize findings in a written product.', 10, 11, 'CCSS-ELA W.7 / W.8'),
  ('Language & Communication', 'Engage in formal academic discussion and debate', 'Participate in structured discussions and formal debate. Present arguments with evidence, respond to counterarguments respectfully.', 10, 11, 'CCSS-ELA SL.5 / SL.6'),
  ('Language & Communication', 'Analyze complex literary texts', 'Analyze theme, character development, figurative language, and structure in complex literary works. Interpret meaning beyond the literal level.', 12, 14, 'CCSS-ELA RL.7 / RL.8'),
  ('Language & Communication', 'Write persuasive and argumentative texts', 'Construct written arguments with a clear claim, logical reasoning, relevant evidence, and counterargument acknowledgment.', 12, 14, 'CCSS-ELA W.7 / W.8'),
  ('Language & Communication', 'Evaluate media and digital information critically', 'Assess the credibility, bias, and purpose of information in digital and media formats. Identify misinformation strategies. Recognize cognitive biases and logical fallacies.', 12, 14, 'CCSS-ELA RI.8 / ISTE'),
  ('Language & Communication', 'Adapt communication style to audience and purpose', 'Adjust vocabulary, tone, and format to suit different audiences and contexts — formal writing, peer conversation, public presentation.', 12, 14, 'CCSS-ELA SL.8 / L.8'),
  ('Mathematical Thinking', 'Count and represent numbers to 20', 'Count forward and backward to 20, represent quantities using objects, drawings, or numerals.', 4, 5, 'CCSS-Math K.CC'),
  ('Mathematical Thinking', 'Compare quantities (more, fewer, equal)', 'Identify and describe which group has more, fewer, or the same number of objects up to 10.', 4, 5, 'CCSS-Math K.CC'),
  ('Mathematical Thinking', 'Understand basic shapes and spatial relationships', 'Identify and describe 2D shapes (circle, square, triangle, rectangle). Understand positional language: above, below, beside, inside, outside.', 4, 5, 'CCSS-Math K.G / EYFS'),
  ('Mathematical Thinking', 'Sort, classify, and recognize patterns', 'Sort objects by one attribute (color, size, shape). Identify, copy, and extend repeating patterns (AB, ABB) using objects or movement.', 4, 5, 'CCSS-Math K.MD / EYFS'),
  ('Mathematical Thinking', 'Engage in cause-and-effect thinking', 'Understand that actions have consequences. Predict what will happen if a variable changes in a simple situation. Try different approaches when one does not work.', 4, 5, 'CDC / EYFS'),
  ('Mathematical Thinking', 'Add and subtract within 20', 'Use objects, drawings, and equations to add and subtract within 20. Understand the relationship between addition and subtraction.', 6, 7, 'CCSS-Math 1.OA'),
  ('Mathematical Thinking', 'Understand place value to 100', 'Understand that two-digit numbers represent tens and ones. Compare two-digit numbers using <, =, >.', 6, 7, 'CCSS-Math 1.NBT / 2.NBT'),
  ('Mathematical Thinking', 'Measure length using standard units', 'Measure and compare lengths of objects using centimeters and inches. Understand that measurement requires a consistent unit.', 6, 7, 'CCSS-Math 2.MD'),
  ('Mathematical Thinking', 'Interpret simple graphs and data', 'Read and interpret picture graphs and bar graphs. Answer questions using data (how many more, how many total).', 6, 7, 'CCSS-Math 2.MD'),
  ('Mathematical Thinking', 'Break a problem into steps and check work', 'Identify the component steps of a math problem. Execute steps in sequence. Check work at each stage and identify where an error occurred.', 6, 7, 'CCSS-Math MP.1 / MP.6'),
  ('Mathematical Thinking', 'Multiply and divide within 100', 'Know multiplication facts for single-digit numbers. Understand the relationship between multiplication and division.', 8, 9, 'CCSS-Math 3.OA'),
  ('Mathematical Thinking', 'Understand fractions as parts of a whole', 'Represent fractions (halves, thirds, quarters) on a number line and in real-world contexts. Compare simple fractions.', 8, 9, 'CCSS-Math 3.NF'),
  ('Mathematical Thinking', 'Calculate area and perimeter', 'Find the area and perimeter of rectangles and irregular shapes. Understand area as covering square units.', 8, 9, 'CCSS-Math 3.MD'),
  ('Mathematical Thinking', 'Represent and interpret data in tables and graphs', 'Collect, organize, and display data in frequency tables, bar graphs, and line plots. Draw conclusions from data.', 8, 9, 'CCSS-Math 3.MD'),
  ('Mathematical Thinking', 'Use multiple strategies to solve problems and justify choices', 'Recognize that there are multiple valid approaches to a problem. Choose and justify a strategy. Compare strategies with peers and evaluate which is most efficient.', 8, 9, 'CCSS-Math MP.1 / MP.3'),
  ('Mathematical Thinking', 'Operate with decimals and fractions', 'Add, subtract, multiply, and divide fractions and decimals. Convert between forms. Apply in real-world problems.', 10, 11, 'CCSS-Math 5.NF / 5.NBT'),
  ('Mathematical Thinking', 'Understand ratios and proportional relationships', 'Understand ratio concepts, use ratio reasoning to solve problems. Recognize proportional relationships in tables and graphs.', 10, 11, 'CCSS-Math 6.RP'),
  ('Mathematical Thinking', 'Analyze statistical data with measures of center', 'Calculate mean, median, mode, and range. Understand what these measures tell you about a dataset and identify their limitations.', 10, 11, 'CCSS-Math 6.SP'),
  ('Mathematical Thinking', 'Identify relevant information and evaluate a solution', 'Distinguish relevant from irrelevant information in a problem. Identify what is missing. Assess whether a solution actually addresses the problem and consider improvements.', 10, 11, 'CCSS-Math MP.1 / MP.3'),
  ('Mathematical Thinking', 'Use algebraic expressions and equations', 'Write and evaluate expressions with variables. Solve one-step and two-step equations and inequalities.', 12, 14, 'CCSS-Math 6.EE / 7.EE'),
  ('Mathematical Thinking', 'Understand proportional relationships and percentages', 'Solve multi-step ratio, rate, and percent problems including markup, discount, tax, and simple interest.', 12, 14, 'CCSS-Math 7.RP'),
  ('Mathematical Thinking', 'Apply geometric reasoning', 'Understand properties of angles, triangles, and polygons. Apply formulas for area, surface area, and volume. Use coordinate geometry.', 12, 14, 'CCSS-Math 7.G / 8.G'),
  ('Mathematical Thinking', 'Understand functions and linear relationships', 'Define and graph functions. Understand slope and y-intercept. Model real-world situations with linear equations.', 12, 14, 'CCSS-Math 8.F / 8.EE'),
  ('Mathematical Thinking', 'Apply probability and statistical reasoning', 'Understand probability as likelihood. Calculate theoretical and experimental probability. Interpret data distributions and communicate complex reasoning clearly.', 12, 14, 'CCSS-Math 7.SP / MP.3'),
  ('Scientific & Environmental Inquiry', 'Observe and describe the natural world', 'Use the five senses to observe and describe properties of objects and natural phenomena. Ask questions about what is noticed.', 4, 5, 'NGSS K-PS2 / EYFS'),
  ('Scientific & Environmental Inquiry', 'Sort and classify natural objects', 'Group animals, plants, rocks, or materials by observable properties. Describe the rule for grouping.', 4, 5, 'NGSS K-LS1 / EYFS'),
  ('Scientific & Environmental Inquiry', 'Understand basic needs of living things', 'Identify that plants and animals need food, water, air, and space to survive. Recognize humans as living things with the same needs.', 4, 5, 'NGSS K-LS1'),
  ('Scientific & Environmental Inquiry', 'Observe weather and seasonal patterns', 'Observe and record daily weather. Identify patterns across seasons (temperature, precipitation, daylight). Connect patterns to the natural environment.', 4, 5, 'NGSS K-ESS2'),
  ('Scientific & Environmental Inquiry', 'Ask testable questions and make predictions', 'Identify a question that can be answered through observation or simple testing. Make a prediction (hypothesis) and explain the reasoning behind it.', 6, 7, 'NGSS Science Practices 1-3'),
  ('Scientific & Environmental Inquiry', 'Conduct simple investigations and record results', 'Plan and conduct a simple experiment. Record observations using drawings, tally marks, or basic data tables. Identify what the results show.', 6, 7, 'NGSS Science Practices 3-4'),
  ('Scientific & Environmental Inquiry', 'Understand properties of materials and matter', 'Describe and compare properties of materials (hardness, flexibility, transparency, texture). Identify changes to materials.', 6, 7, 'NGSS 2-PS1'),
  ('Scientific & Environmental Inquiry', 'Understand plant and animal life cycles', 'Describe the stages of life cycles for common plants and animals. Understand that offspring resemble parents.', 6, 7, 'NGSS 1-LS3 / 2-LS4'),
  ('Scientific & Environmental Inquiry', 'Understand ecosystems and food webs', 'Describe how organisms in an ecosystem depend on each other and their environment. Construct a simple food chain and food web.', 8, 9, 'NGSS 3-LS2 / 5-LS2'),
  ('Scientific & Environmental Inquiry', 'Understand forces and motion', 'Describe how forces (push, pull, gravity, friction) affect the motion of objects. Plan investigations to test the effect of forces.', 8, 9, 'NGSS 3-PS2'),
  ('Scientific & Environmental Inquiry', 'Understand Earth''s systems and natural resources', 'Describe how wind, water, and ice shape Earth''s surface. Understand renewable and non-renewable resources and their responsible use.', 8, 9, 'NGSS 4-ESS2 / 4-ESS3'),
  ('Scientific & Environmental Inquiry', 'Use data to support or refute a claim', 'Analyze data from an investigation to determine whether it supports or contradicts a hypothesis. Identify limitations of the data and what further investigation is needed.', 8, 9, 'NGSS Science Practices 4-6'),
  ('Scientific & Environmental Inquiry', 'Understand the structure and function of living systems', 'Explain how cells, organs, and body systems work together. Connect structure to function in plants and animals.', 10, 11, 'NGSS MS-LS1'),
  ('Scientific & Environmental Inquiry', 'Understand energy transfer and transformation', 'Describe how energy is transferred between objects and transformed from one form to another (heat, light, sound, electrical, kinetic).', 10, 11, 'NGSS MS-PS3'),
  ('Scientific & Environmental Inquiry', 'Understand Earth''s place in the solar system', 'Explain the relative positions and motions of Earth, the Moon, and the Sun. Connect to patterns of day, night, tides, and seasons.', 10, 11, 'NGSS MS-ESS1'),
  ('Scientific & Environmental Inquiry', 'Apply the engineering design process', 'Define a real problem, brainstorm solutions, prototype, test, and iterate. Evaluate the solution against defined criteria and constraints.', 10, 11, 'NGSS ETS1'),
  ('Scientific & Environmental Inquiry', 'Apply systematic inquiry to answer a question', 'Formulate a question, identify and evaluate evidence, draw a reasoned conclusion, and identify what would change the conclusion. Document the full process.', 10, 11, 'NGSS Science Practices 1-8'),
  ('Scientific & Environmental Inquiry', 'Understand chemical reactions and atomic structure', 'Describe how atoms combine to form molecules. Understand the basics of chemical reactions: reactants, products, conservation of mass.', 12, 14, 'NGSS MS-PS1'),
  ('Scientific & Environmental Inquiry', 'Understand genetics and heredity', 'Explain how traits are passed from parents to offspring. Understand the role of genes, chromosomes, and environmental influences on expression.', 12, 14, 'NGSS MS-LS3'),
  ('Scientific & Environmental Inquiry', 'Understand human impact on Earth''s systems', 'Analyze how human activity affects Earth''s systems. Evaluate evidence for climate change, biodiversity loss, and resource depletion. Propose and assess mitigation strategies.', 12, 14, 'NGSS MS-ESS3'),
  ('Scientific & Environmental Inquiry', 'Design and communicate an independent scientific investigation', 'Design a complete investigation with a clear question, method, controlled variables, data collection, analysis, and conclusion. Communicate findings to an audience and respond to questions.', 12, 14, 'NGSS Science Practices 1-8'),
  ('Creative Expression & Making', 'Explore materials and tools for making', 'Experiment with art materials (paint, clay, collage, crayons) and tools. Describe choices made in creating.', 4, 5, 'EYFS / National Core Arts Standards'),
  ('Creative Expression & Making', 'Express ideas and stories through drawing', 'Create drawings that communicate a story, idea, or experience. Begin to include recognizable representations of people, objects, and environments.', 4, 5, 'EYFS / CDC'),
  ('Creative Expression & Making', 'Engage in imaginative and dramatic play', 'Participate in imaginative play, taking on roles and using objects symbolically. Develop and sustain a narrative during play.', 4, 5, 'CDC / EYFS'),
  ('Creative Expression & Making', 'Respond to music, movement, and visual art', 'Describe a response to music or artwork using feeling words. Move in response to rhythm and tempo.', 4, 5, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Create a complete artwork with intent', 'Plan and complete an artwork or creative product with a stated intention. Explain what choices were made and why.', 6, 7, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Write and tell original stories', 'Compose original stories with a recognizable beginning, middle, and end. Include characters and a simple problem and solution.', 6, 7, 'CCSS-ELA W.1 / W.2'),
  ('Creative Expression & Making', 'Perform for a small audience', 'Present a short performance (song, poem, dramatic play, dance) to a small audience. Show awareness of the audience and respond to feedback.', 6, 7, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Use elements of art in composition', 'Intentionally use line, color, shape, and space to create expressive compositions. Describe how these elements contribute to the work.', 6, 7, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Develop a creative project over multiple sessions', 'Sustain focus on a creative project across multiple sessions. Revise and refine based on self-assessment and feedback.', 8, 9, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Use narrative structure and voice in writing', 'Write narratives that establish a situation, narrator, and sequence of events. Use descriptive language and dialogue.', 8, 9, 'CCSS-ELA W.3'),
  ('Creative Expression & Making', 'Analyze and interpret creative works', 'Describe and interpret artwork, music, or performance using specific vocabulary. Connect the work to its context and intended meaning.', 8, 9, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Experiment with digital and mixed media', 'Use digital tools (photography, video, audio, design software) as expressive media. Combine digital and physical materials intentionally.', 8, 9, 'ISTE / National Core Arts Standards'),
  ('Creative Expression & Making', 'Develop a distinct creative voice or style', 'Identify recurring themes, preferences, or techniques in their own work. Make intentional stylistic choices that reflect personal perspective.', 10, 11, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Connect creative work to cultural and historical context', 'Explain how artworks and creative traditions reflect the culture and time in which they were made. Compare across cultures.', 10, 11, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Use creative process to explore complex ideas', 'Use creative output (writing, art, design, performance) as a mode of inquiry. Explore ambiguous or complex themes through making.', 10, 11, 'National Core Arts Standards / CCSS-ELA'),
  ('Creative Expression & Making', 'Create and present a substantial independent creative work', 'Produce a significant self-directed creative work (portfolio, performance, project, written piece). Present and defend creative choices to an audience.', 12, 14, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Give and receive constructive critique', 'Provide specific, evidence-based feedback on peers'' creative work. Receive critique with openness and use it to improve.', 12, 14, 'National Core Arts Standards'),
  ('Creative Expression & Making', 'Design and prototype a solution to a real problem', 'Apply design thinking: empathize with users, define the problem, ideate, prototype, and test. Deliver a real or functional solution.', 12, 14, 'ISTE / National Core Arts Standards'),
  ('Inner Self & Well Being', 'Identify and name basic emotions', 'Recognize and name common emotions (happy, sad, angry, scared, surprised) in self and others. Use feeling words in conversation.', 4, 5, 'CASEL / CDC'),
  ('Inner Self & Well Being', 'Follow routines and manage transitions', 'Participate in group settings by following predictable routines. Move between activities without significant distress.', 4, 5, 'CASEL / CDC'),
  ('Inner Self & Well Being', 'Manage frustration and seek help appropriately', 'Identify when feeling frustrated or overwhelmed and use simple coping strategies (take a breath, ask for help). Begin to self-regulate.', 4, 5, 'CASEL / EYFS'),
  ('Inner Self & Well Being', 'Show care and basic empathy toward others', 'Notice when a peer is upset and offer simple help or comfort. Begin to show empathy through words or actions.', 4, 5, 'CASEL / CDC'),
  ('Inner Self & Well Being', 'Understand own strengths and areas for growth', 'Identify things they are good at and things they find hard. Show willingness to try challenging tasks without giving up.', 6, 7, 'CASEL'),
  ('Inner Self & Well Being', 'Show responsibility for personal tasks', 'Complete assigned responsibilities without constant reminders. Take ownership of mistakes and attempt to fix them.', 6, 7, 'CASEL'),
  ('Inner Self & Well Being', 'Recognize emotions and personal triggers', 'Identify what situations tend to trigger strong emotions. Notice physical signals of emotional escalation and apply a calming strategy.', 6, 7, 'CASEL'),
  ('Inner Self & Well Being', 'Demonstrate persistence through difficulty', 'Stay engaged with a difficult task without giving up. Use strategies to cope with frustration. Distinguish between effort and fixed ability.', 8, 9, 'CASEL'),
  ('Inner Self & Well Being', 'Set and work toward a personal goal', 'Identify a meaningful goal, break it into steps, track progress, and reflect on outcomes.', 8, 9, 'CASEL'),
  ('Inner Self & Well Being', 'Show ethical reasoning in decisions', 'Identify ethical dimensions of a decision. Consider impact on self and others. Reflect on personal values as a guide to action.', 8, 9, 'CASEL'),
  ('Inner Self & Well Being', 'Understand and manage complex emotions', 'Identify mixed or complex emotions (e.g., proud and embarrassed simultaneously). Use a range of coping strategies. Reflect on emotional patterns over time.', 10, 11, 'CASEL'),
  ('Inner Self & Well Being', 'Understand mental health and emotional wellbeing', 'Describe what mental health means. Identify signs of stress, anxiety, and burnout. Know strategies for maintaining wellbeing and when to ask for support.', 10, 11, 'CDC / CASEL'),
  ('Inner Self & Well Being', 'Develop a growth mindset toward learning', 'Understand that abilities grow through effort and practice. Reframe setbacks as information rather than failure. Seek feedback actively.', 10, 11, 'CASEL'),
  ('Inner Self & Well Being', 'Reflect on personal identity and values', 'Articulate personal values, interests, and strengths. Understand how identity is shaped by experience, culture, and relationships.', 12, 14, 'CASEL'),
  ('Inner Self & Well Being', 'Manage stress and seek support when needed', 'Recognize signs of stress or overwhelm. Use a range of coping strategies. Reach out to trusted adults or peers appropriately and without shame.', 12, 14, 'CASEL / CDC'),
  ('Inner Self & Well Being', 'Demonstrate self-directed learning', 'Identify a topic or skill of genuine interest and pursue it independently. Manage time, evaluate progress, and adapt strategies without external prompting.', 12, 14, 'CASEL / ISTE'),
  ('Physical Wellbeing & Movement', 'Demonstrate gross motor coordination', 'Run, jump, hop, skip, and climb with developing coordination and balance. Participate in active play.', 4, 5, 'CDC / EYFS'),
  ('Physical Wellbeing & Movement', 'Demonstrate fine motor skills for daily tasks', 'Hold pencils and scissors correctly. Use hands to manipulate small objects, buttons, and fasteners with increasing control.', 4, 5, 'CDC / EYFS'),
  ('Physical Wellbeing & Movement', 'Understand basic hygiene and self-care', 'Wash hands at appropriate times. Understand basic dental hygiene and personal care routines. Manage own basic needs independently.', 4, 5, 'CDC'),
  ('Physical Wellbeing & Movement', 'Understand basic food groups and healthy eating', 'Identify foods that support health and energy. Understand that a variety of foods is part of a healthy diet.', 4, 5, 'CDC / EYFS'),
  ('Physical Wellbeing & Movement', 'Participate in structured physical activity', 'Engage with focus and effort in structured games, sports, or movement activities. Follow rules and safety guidelines.', 6, 7, 'CDC / SHAPE America'),
  ('Physical Wellbeing & Movement', 'Demonstrate body awareness and spatial control', 'Move safely in shared spaces, adjust speed and direction in response to others, and demonstrate awareness of personal space.', 6, 7, 'CDC / SHAPE America'),
  ('Physical Wellbeing & Movement', 'Understand the connection between movement and wellbeing', 'Describe how physical activity affects mood, energy, and sleep. Identify activities they enjoy for their own health and wellbeing.', 6, 7, 'CDC / SHAPE America'),
  ('Physical Wellbeing & Movement', 'Develop a physical skill through deliberate practice', 'Set a physical challenge (catching, balancing, a sport skill) and practice it consistently over time. Track and reflect on improvement.', 8, 9, 'SHAPE America'),
  ('Physical Wellbeing & Movement', 'Understand components of physical fitness', 'Identify and describe strength, flexibility, endurance, and coordination. Connect these components to long-term health outcomes.', 8, 9, 'SHAPE America'),
  ('Physical Wellbeing & Movement', 'Make healthy choices in food, sleep, and activity', 'Explain the role of sleep, nutrition, and physical activity in maintaining health. Make deliberate healthy choices in everyday contexts.', 8, 9, 'CDC'),
  ('Physical Wellbeing & Movement', 'Understand puberty and body changes', 'Understand the physical and emotional changes associated with puberty. Know that these are normal developmental processes and vary between individuals.', 10, 11, 'CDC'),
  ('Physical Wellbeing & Movement', 'Develop a personal fitness routine', 'Design and maintain a basic personal fitness plan with varied activity types. Reflect on progress and adjust the plan over time.', 10, 11, 'SHAPE America'),
  ('Physical Wellbeing & Movement', 'Understand online safety and digital wellbeing', 'Identify safe and risky online behaviors. Understand screen time effects on sleep and mood. Know how to respond to online conflict or unwanted contact.', 10, 11, 'CDC / ISTE'),
  ('Physical Wellbeing & Movement', 'Understand risk, consent, and personal boundaries', 'Articulate concepts of personal boundaries and consent in physical and social contexts. Recognize unsafe situations and know how to respond.', 12, 14, 'CDC'),
  ('Physical Wellbeing & Movement', 'Manage personal health and self-care independently', 'Take initiative for personal health practices including sleep, nutrition, hygiene, and physical activity without adult prompting.', 12, 14, 'CDC'),
  ('Physical Wellbeing & Movement', 'Understand substance use and health consequences', 'Describe the physical and social consequences of substance use. Identify strategies for making safe decisions under social pressure.', 12, 14, 'CDC'),
  ('Collaboration & Relational Skills', 'Take turns and share with others', 'Share materials, take turns in games and activities, and wait without significant distress. Acknowledge others'' right to participate.', 4, 5, 'CASEL / CDC'),
  ('Collaboration & Relational Skills', 'Play cooperatively with peers', 'Join group play, contribute to shared goals, and adjust own behavior to fit the group''s needs. Begin to negotiate roles.', 4, 5, 'CASEL / CDC / EYFS'),
  ('Collaboration & Relational Skills', 'Listen actively to others', 'Give full attention when others speak. Avoid interrupting. Ask questions to understand rather than to respond.', 4, 5, 'CASEL / EYFS'),
  ('Collaboration & Relational Skills', 'Resolve simple conflicts with peers', 'Identify a conflict, listen to another''s perspective, and attempt a fair resolution. Know when to ask an adult for help.', 6, 7, 'CASEL / CDC'),
  ('Collaboration & Relational Skills', 'Build and maintain friendships', 'Initiate and sustain positive peer relationships. Show awareness of what makes a good friend. Repair relationships after conflict.', 6, 7, 'CASEL / CDC'),
  ('Collaboration & Relational Skills', 'Contribute fairly in group tasks', 'Accept and fulfill a role within a group. Complete the assigned contribution without relying on others to cover it. Acknowledge others'' contributions.', 6, 7, 'CASEL'),
  ('Collaboration & Relational Skills', 'Show empathy and perspective-taking', 'Consider another person''s feelings and viewpoint before responding. Adjust behavior based on awareness of how actions affect others.', 6, 7, 'CASEL'),
  ('Collaboration & Relational Skills', 'Navigate peer pressure and make independent decisions', 'Recognize peer pressure situations. Use assertive communication to express own views while respecting others. Make decisions that align with personal values.', 8, 9, 'CASEL / CDC'),
  ('Collaboration & Relational Skills', 'Negotiate and reach shared agreements', 'Identify areas of disagreement within a group, propose compromises, and work toward a solution that acknowledges multiple perspectives.', 8, 9, 'CASEL'),
  ('Collaboration & Relational Skills', 'Give and receive feedback constructively', 'Offer specific, respectful feedback on others'' work or ideas. Receive feedback without defensiveness and use it to improve.', 8, 9, 'CASEL / National Core Arts Standards'),
  ('Collaboration & Relational Skills', 'Manage group dynamics and shared accountability', 'Monitor whether the group is on track. Address unequal participation respectfully. Hold self and others accountable without blame.', 8, 9, 'CASEL'),
  ('Collaboration & Relational Skills', 'Analyze problems from multiple perspectives before deciding', 'Understand that complex problems involve multiple stakeholders with different interests. Deliberately seek out perspectives different from your own before forming a conclusion.', 10, 11, 'CASEL / CCSS-ELA'),
  ('Collaboration & Relational Skills', 'Lead and support others in a group', 'Take initiative when needed, support others'' participation, navigate disagreement constructively, and keep a group focused on a shared goal.', 10, 11, 'CASEL'),
  ('Collaboration & Relational Skills', 'Collaborate across difference', 'Work effectively with people who have different backgrounds, communication styles, or opinions. Recognize how difference strengthens group output.', 10, 11, 'CASEL'),
  ('Collaboration & Relational Skills', 'Demonstrate interpersonal integrity', 'Keep commitments made to others. Speak honestly even when it is uncomfortable. Acknowledge mistakes to the group and take corrective action.', 10, 11, 'CASEL'),
  ('Collaboration & Relational Skills', 'Navigate conflict constructively in complex situations', 'Approach serious conflicts with curiosity rather than defensiveness. Use negotiation and mediation strategies. Know when disengagement is the right choice.', 12, 14, 'CASEL'),
  ('Collaboration & Relational Skills', 'Co-create a substantial shared product', 'Plan, produce, and deliver a significant collaborative output (project, performance, publication). Divide work equitably, integrate contributions, and present jointly.', 12, 14, 'CASEL / National Core Arts Standards'),
  ('Collaboration & Relational Skills', 'Give feedback that improves group reasoning', 'Identify weaknesses in a group''s shared reasoning or plan. Raise concerns clearly and propose improvements. Distinguish between critiquing ideas and critiquing people.', 12, 14, 'CASEL / CCSS-ELA SL'),
  ('Collaboration & Relational Skills', 'Build and sustain trust in relationships', 'Understand what builds and erodes trust. Consistently act in ways that are reliable, honest, and respectful over time. Repair trust after it has been broken.', 12, 14, 'CASEL'),
  ('Global Citizenship & Contribution', 'Recognize that people have different backgrounds and traditions', 'Notice and describe differences in how families celebrate, eat, dress, and speak. Show curiosity rather than judgment.', 4, 5, 'CASEL / EYFS'),
  ('Global Citizenship & Contribution', 'Identify own cultural identity and family practices', 'Describe family traditions, foods, languages, and practices that are meaningful. Connect these to a sense of personal identity.', 4, 5, 'CASEL / EYFS'),
  ('Global Citizenship & Contribution', 'Show respect for people who are different', 'Use respectful language and behavior toward people with different abilities, backgrounds, or appearances. Speak up when someone is treated unkindly.', 4, 5, 'CASEL'),
  ('Global Citizenship & Contribution', 'Understand basic community roles and responsibilities', 'Identify community helpers and their roles. Understand that communities depend on people contributing to shared needs.', 6, 7, 'Social Studies C3'),
  ('Global Citizenship & Contribution', 'Understand that the world has many languages and cultures', 'Identify that different countries have different languages, foods, and customs. Show curiosity about cultures beyond their own.', 6, 7, 'Social Studies C3 / CASEL'),
  ('Global Citizenship & Contribution', 'Understand basic human rights and fairness', 'Describe what it means for something to be fair or unfair. Identify basic rights that all people should have. Discuss real situations where these are not honored.', 6, 7, 'Social Studies C3 / CASEL'),
  ('Global Citizenship & Contribution', 'Understand how geography shapes culture and daily life', 'Explain how climate, location, and resources influence how people live, work, and build communities in different places.', 8, 9, 'Social Studies C3 / NGSS ESS3'),
  ('Global Citizenship & Contribution', 'Understand historical events and their causes', 'Explain how past events led to present-day conditions. Identify multiple causes and effects of key historical events.', 8, 9, 'Social Studies C3'),
  ('Global Citizenship & Contribution', 'Communicate across cultural differences', 'Adapt communication style with awareness of cultural norms. Ask questions to understand rather than assuming. Recognize when a misunderstanding may be cultural.', 8, 9, 'CASEL / Social Studies C3'),
  ('Global Citizenship & Contribution', 'Engage with civic processes and democratic participation', 'Understand how rules and laws are made in democratic systems. Participate in class or community decision-making processes. Understand the concept of civic responsibility.', 8, 9, 'Social Studies C3'),
  ('Global Citizenship & Contribution', 'Analyze bias and representation in media and texts', 'Identify whose perspectives are included and excluded in a text, image, or media product. Analyze how this shapes understanding of events or groups.', 10, 11, 'CCSS-ELA RI.6 / Social Studies C3'),
  ('Global Citizenship & Contribution', 'Understand global interdependence', 'Explain how economies, environments, and political systems are interconnected globally. Identify how local actions can have global effects.', 10, 11, 'Social Studies C3 / NGSS ESS3'),
  ('Global Citizenship & Contribution', 'Investigate a social issue and propose action', 'Research a local or global social issue, evaluate multiple perspectives, and propose an informed course of action or advocacy.', 10, 11, 'Social Studies C3 / CCSS-ELA W.7'),
  ('Global Citizenship & Contribution', 'Understand systems of power, privilege, and inequality', 'Describe how systems of power have historically distributed advantage and disadvantage. Connect historical patterns to present-day inequalities.', 12, 14, 'Social Studies C3 / CASEL'),
  ('Global Citizenship & Contribution', 'Engage across cultural and ideological difference', 'Engage respectfully and curiously with people who hold significantly different cultural, political, or ideological views. Distinguish disagreement from disrespect.', 12, 14, 'CASEL / Social Studies C3'),
  ('Global Citizenship & Contribution', 'Take informed civic action', 'Identify a real community or global need, evaluate options for civic engagement, and take meaningful action (petition, service, advocacy, creative work).', 12, 14, 'Social Studies C3'),
  ('Global Citizenship & Contribution', 'Reflect on own cultural assumptions and biases', 'Identify ways that their own cultural background shapes their assumptions and worldview. Demonstrate willingness to revise assumptions when presented with new information.', 12, 14, 'CASEL')
)
insert into skills (
  school_id, name, description,
  age_band_start, age_band_end, domain_id, source_reference,
  is_assessable, source_framework
)
select
  null::uuid,
  i.name,
  i.description,
  i.age_band_start,
  i.age_band_end,
  d.id,
  i.source_reference,
  true,
  'baseline'
from incoming i
join domains d on d.name = i.domain_name;

-- 4. Quick verification: count inserted rows per domain.
with default_profile as (
  select id from learner_profiles where is_default = true limit 1
),
counts as (
  select d.name as domain, count(s.id) as skill_count
  from learner_profile_domains d
  left join skills s on s.domain_id = d.id and s.school_id is null
  join default_profile p on p.id = d.profile_id
  group by d.name
  order by d.name
)
select * from counts;

commit;
