-- 076_replace_default_framework_function.sql
-- The trigger from 031 (`seed_framework_on_school_create`) calls
-- `seed_default_competency_framework(p_school_id)`. After 069 wiped the old
-- Common Core seed and reseeded with the Boundless Developmental Skill
-- Baseline, that function still held the old Common Core body — so any new
-- school created after 069 would re-seed the obsolete framework.
--
-- This migration replaces the function body with the Boundless baseline
-- (lifted verbatim from 069's per-school loop) so new schools get the
-- correct standards on insert. The trigger from 031 keeps pointing at this
-- function, so no trigger plumbing changes here.

create or replace function seed_default_competency_framework(p_school_id uuid)
returns uuid
language plpgsql
security definer
as $func$
declare
  fw_id uuid;
  domain_id uuid;
  subdomain_id uuid;
begin
  select id into fw_id
    from competency_frameworks
    where school_id = p_school_id and is_default = true
    limit 1;

  if fw_id is not null then
    return fw_id;
  end if;

  insert into competency_frameworks (school_id, name, description, version, is_default)
  values (
    p_school_id,
    'Boundless Developmental Skill Baseline',
    'Default developmental standards for learners ages 4-14, organized by domain and age band. Sources: CCSS, NGSS, CDC, CASEL, EYFS, ISTE.',
    '1.1',
    true
  )
  returning id into fw_id;

    -- Domain LC: Language & Communication
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Language & Communication', 'LC', 1)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.4-5.1', 'Recognize letters and their sounds', 'Identify all uppercase and lowercase letters. Associate each letter with its primary sound (phonemic awareness).', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.4-5.2', 'Speak clearly in complete sentences', 'Express ideas in complete sentences with appropriate volume and eye contact. Take turns in conversation.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.4-5.3', 'Listen and respond to stories and instructions', 'Listen attentively to read-alouds and short instructions. Retell key events or follow two-step directions.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.4-5.4', 'Write letters and simple words', 'Write own name and familiar words. Represent ideas through drawing combined with emergent writing.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.4-5.5', 'Understand print concepts', 'Understand that print carries meaning, how to hold a book, directionality (left to right, top to bottom), and that words are separated by spaces.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.6-7.1', 'Decode and read simple texts fluently', 'Apply phonics knowledge to decode unfamiliar words. Read grade-level texts with sufficient accuracy and fluency to support comprehension.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.6-7.2', 'Comprehend and retell narrative texts', 'Identify key details, characters, setting, and problem/solution in stories. Retell using beginning, middle, and end.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.6-7.3', 'Write sentences with correct mechanics', 'Write complete sentences with capitalization and end punctuation. Use spaces between words consistently.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.6-7.4', 'Ask and answer questions about a text', 'Ask and answer questions (who, what, where, when, why, how) about key details in a text. Use evidence from the text.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.6-7.5', 'Distinguish facts from opinions', 'Identify statements as factual claims or opinions. Understand that facts can be verified and opinions reflect perspectives.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.1', 'Read and understand informational texts', 'Identify main idea and supporting details in nonfiction. Use text features (headings, captions, glossary).', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.2', 'Write structured paragraphs with a clear purpose', 'Write opinion, informative, and narrative paragraphs with a topic sentence, supporting details, and a conclusion.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.3', 'Use context clues to determine word meaning', 'Use context and word structure (prefixes, suffixes, roots) to determine the meaning of unfamiliar words.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.4', 'Compare and contrast multiple texts on a topic', 'Explain the similarities and differences between two texts on the same topic. Identify how different authors treat the same information.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.5', 'Deliver a short prepared presentation', 'Plan and deliver a short oral presentation on a chosen topic. Use appropriate pacing, volume, and visual support.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.8-9.6', 'Construct and critique written arguments', 'Build a written argument with a clear claim and supporting evidence. Identify weaknesses in own and others'' arguments.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.10-11.1', 'Write multi-paragraph essays with a thesis', 'Write well-structured essays with an introduction, body paragraphs, and conclusion. State and develop a clear claim.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.10-11.2', 'Cite evidence from texts to support analysis', 'Quote or paraphrase text evidence to support interpretation or argument. Distinguish evidence from opinion.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.10-11.3', 'Identify author''s purpose and point of view', 'Analyze how an author''s purpose, perspective, or bias influences the content and structure of a text.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.10-11.4', 'Conduct research and synthesize information', 'Gather information from multiple sources, evaluate source credibility, and synthesize findings in a written product.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.10-11.5', 'Engage in formal academic discussion and debate', 'Participate in structured discussions and formal debate. Present arguments with evidence, respond to counterarguments respectfully.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.12-14.1', 'Analyze complex literary texts', 'Analyze theme, character development, figurative language, and structure in complex literary works. Interpret meaning beyond the literal level.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.12-14.2', 'Write persuasive and argumentative texts', 'Construct written arguments with a clear claim, logical reasoning, relevant evidence, and counterargument acknowledgment.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.12-14.3', 'Evaluate media and digital information critically', 'Assess the credibility, bias, and purpose of information in digital and media formats. Identify misinformation strategies. Recognize cognitive biases and logical fallacies.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'LC.12-14.4', 'Adapt communication style to audience and purpose', 'Adjust vocabulary, tone, and format to suit different audiences and contexts — formal writing, peer conversation, public presentation.', '{}'::jsonb, 12, 14);

    -- Domain MT: Mathematical Thinking
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Mathematical Thinking', 'MT', 2)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.4-5.1', 'Count and represent numbers to 20', 'Count forward and backward to 20, represent quantities using objects, drawings, or numerals.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.4-5.2', 'Compare quantities (more, fewer, equal)', 'Identify and describe which group has more, fewer, or the same number of objects up to 10.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.4-5.3', 'Understand basic shapes and spatial relationships', 'Identify and describe 2D shapes (circle, square, triangle, rectangle). Understand positional language: above, below, beside, inside, outside.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.4-5.4', 'Sort, classify, and recognize patterns', 'Sort objects by one attribute (color, size, shape). Identify, copy, and extend repeating patterns (AB, ABB) using objects or movement.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.4-5.5', 'Engage in cause-and-effect thinking', 'Understand that actions have consequences. Predict what will happen if a variable changes in a simple situation. Try different approaches when one does not work.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.6-7.1', 'Add and subtract within 20', 'Use objects, drawings, and equations to add and subtract within 20. Understand the relationship between addition and subtraction.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.6-7.2', 'Understand place value to 100', 'Understand that two-digit numbers represent tens and ones. Compare two-digit numbers using <, =, >.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.6-7.3', 'Measure length using standard units', 'Measure and compare lengths of objects using centimeters and inches. Understand that measurement requires a consistent unit.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.6-7.4', 'Interpret simple graphs and data', 'Read and interpret picture graphs and bar graphs. Answer questions using data (how many more, how many total).', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.6-7.5', 'Break a problem into steps and check work', 'Identify the component steps of a math problem. Execute steps in sequence. Check work at each stage and identify where an error occurred.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.8-9.1', 'Multiply and divide within 100', 'Know multiplication facts for single-digit numbers. Understand the relationship between multiplication and division.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.8-9.2', 'Understand fractions as parts of a whole', 'Represent fractions (halves, thirds, quarters) on a number line and in real-world contexts. Compare simple fractions.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.8-9.3', 'Calculate area and perimeter', 'Find the area and perimeter of rectangles and irregular shapes. Understand area as covering square units.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.8-9.4', 'Represent and interpret data in tables and graphs', 'Collect, organize, and display data in frequency tables, bar graphs, and line plots. Draw conclusions from data.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.8-9.5', 'Use multiple strategies to solve problems and justify choices', 'Recognize that there are multiple valid approaches to a problem. Choose and justify a strategy. Compare strategies with peers and evaluate which is most efficient.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.10-11.1', 'Operate with decimals and fractions', 'Add, subtract, multiply, and divide fractions and decimals. Convert between forms. Apply in real-world problems.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.10-11.2', 'Understand ratios and proportional relationships', 'Understand ratio concepts, use ratio reasoning to solve problems. Recognize proportional relationships in tables and graphs.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.10-11.3', 'Analyze statistical data with measures of center', 'Calculate mean, median, mode, and range. Understand what these measures tell you about a dataset and identify their limitations.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.10-11.4', 'Identify relevant information and evaluate a solution', 'Distinguish relevant from irrelevant information in a problem. Identify what is missing. Assess whether a solution actually addresses the problem and consider improvements.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.12-14.1', 'Use algebraic expressions and equations', 'Write and evaluate expressions with variables. Solve one-step and two-step equations and inequalities.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.12-14.2', 'Understand proportional relationships and percentages', 'Solve multi-step ratio, rate, and percent problems including markup, discount, tax, and simple interest.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.12-14.3', 'Apply geometric reasoning', 'Understand properties of angles, triangles, and polygons. Apply formulas for area, surface area, and volume. Use coordinate geometry.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.12-14.4', 'Understand functions and linear relationships', 'Define and graph functions. Understand slope and y-intercept. Model real-world situations with linear equations.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'MT.12-14.5', 'Apply probability and statistical reasoning', 'Understand probability as likelihood. Calculate theoretical and experimental probability. Interpret data distributions and communicate complex reasoning clearly.', '{}'::jsonb, 12, 14);

    -- Domain SE: Scientific & Environmental Inquiry
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Scientific & Environmental Inquiry', 'SE', 3)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.4-5.1', 'Observe and describe the natural world', 'Use the five senses to observe and describe properties of objects and natural phenomena. Ask questions about what is noticed.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.4-5.2', 'Sort and classify natural objects', 'Group animals, plants, rocks, or materials by observable properties. Describe the rule for grouping.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.4-5.3', 'Understand basic needs of living things', 'Identify that plants and animals need food, water, air, and space to survive. Recognize humans as living things with the same needs.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.4-5.4', 'Observe weather and seasonal patterns', 'Observe and record daily weather. Identify patterns across seasons (temperature, precipitation, daylight). Connect patterns to the natural environment.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.6-7.1', 'Ask testable questions and make predictions', 'Identify a question that can be answered through observation or simple testing. Make a prediction (hypothesis) and explain the reasoning behind it.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.6-7.2', 'Conduct simple investigations and record results', 'Plan and conduct a simple experiment. Record observations using drawings, tally marks, or basic data tables. Identify what the results show.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.6-7.3', 'Understand properties of materials and matter', 'Describe and compare properties of materials (hardness, flexibility, transparency, texture). Identify changes to materials.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.6-7.4', 'Understand plant and animal life cycles', 'Describe the stages of life cycles for common plants and animals. Understand that offspring resemble parents.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.8-9.1', 'Understand ecosystems and food webs', 'Describe how organisms in an ecosystem depend on each other and their environment. Construct a simple food chain and food web.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.8-9.2', 'Understand forces and motion', 'Describe how forces (push, pull, gravity, friction) affect the motion of objects. Plan investigations to test the effect of forces.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.8-9.3', 'Understand Earth''s systems and natural resources', 'Describe how wind, water, and ice shape Earth''s surface. Understand renewable and non-renewable resources and their responsible use.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.8-9.4', 'Use data to support or refute a claim', 'Analyze data from an investigation to determine whether it supports or contradicts a hypothesis. Identify limitations of the data and what further investigation is needed.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.10-11.1', 'Understand the structure and function of living systems', 'Explain how cells, organs, and body systems work together. Connect structure to function in plants and animals.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.10-11.2', 'Understand energy transfer and transformation', 'Describe how energy is transferred between objects and transformed from one form to another (heat, light, sound, electrical, kinetic).', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.10-11.3', 'Understand Earth''s place in the solar system', 'Explain the relative positions and motions of Earth, the Moon, and the Sun. Connect to patterns of day, night, tides, and seasons.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.10-11.4', 'Apply the engineering design process', 'Define a real problem, brainstorm solutions, prototype, test, and iterate. Evaluate the solution against defined criteria and constraints.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.10-11.5', 'Apply systematic inquiry to answer a question', 'Formulate a question, identify and evaluate evidence, draw a reasoned conclusion, and identify what would change the conclusion. Document the full process.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.12-14.1', 'Understand chemical reactions and atomic structure', 'Describe how atoms combine to form molecules. Understand the basics of chemical reactions: reactants, products, conservation of mass.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.12-14.2', 'Understand genetics and heredity', 'Explain how traits are passed from parents to offspring. Understand the role of genes, chromosomes, and environmental influences on expression.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.12-14.3', 'Understand human impact on Earth''s systems', 'Analyze how human activity affects Earth''s systems. Evaluate evidence for climate change, biodiversity loss, and resource depletion. Propose and assess mitigation strategies.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'SE.12-14.4', 'Design and communicate an independent scientific investigation', 'Design a complete investigation with a clear question, method, controlled variables, data collection, analysis, and conclusion. Communicate findings to an audience and respond to questions.', '{}'::jsonb, 12, 14);

    -- Domain CE: Creative Expression & Making
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Creative Expression & Making', 'CE', 4)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.4-5.1', 'Explore materials and tools for making', 'Experiment with art materials (paint, clay, collage, crayons) and tools. Describe choices made in creating.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.4-5.2', 'Express ideas and stories through drawing', 'Create drawings that communicate a story, idea, or experience. Begin to include recognizable representations of people, objects, and environments.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.4-5.3', 'Engage in imaginative and dramatic play', 'Participate in imaginative play, taking on roles and using objects symbolically. Develop and sustain a narrative during play.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.4-5.4', 'Respond to music, movement, and visual art', 'Describe a response to music or artwork using feeling words. Move in response to rhythm and tempo.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.6-7.1', 'Create a complete artwork with intent', 'Plan and complete an artwork or creative product with a stated intention. Explain what choices were made and why.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.6-7.2', 'Write and tell original stories', 'Compose original stories with a recognizable beginning, middle, and end. Include characters and a simple problem and solution.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.6-7.3', 'Perform for a small audience', 'Present a short performance (song, poem, dramatic play, dance) to a small audience. Show awareness of the audience and respond to feedback.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.6-7.4', 'Use elements of art in composition', 'Intentionally use line, color, shape, and space to create expressive compositions. Describe how these elements contribute to the work.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.8-9.1', 'Develop a creative project over multiple sessions', 'Sustain focus on a creative project across multiple sessions. Revise and refine based on self-assessment and feedback.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.8-9.2', 'Use narrative structure and voice in writing', 'Write narratives that establish a situation, narrator, and sequence of events. Use descriptive language and dialogue.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.8-9.3', 'Analyze and interpret creative works', 'Describe and interpret artwork, music, or performance using specific vocabulary. Connect the work to its context and intended meaning.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.8-9.4', 'Experiment with digital and mixed media', 'Use digital tools (photography, video, audio, design software) as expressive media. Combine digital and physical materials intentionally.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.10-11.1', 'Develop a distinct creative voice or style', 'Identify recurring themes, preferences, or techniques in their own work. Make intentional stylistic choices that reflect personal perspective.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.10-11.2', 'Connect creative work to cultural and historical context', 'Explain how artworks and creative traditions reflect the culture and time in which they were made. Compare across cultures.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.10-11.3', 'Use creative process to explore complex ideas', 'Use creative output (writing, art, design, performance) as a mode of inquiry. Explore ambiguous or complex themes through making.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.12-14.1', 'Create and present a substantial independent creative work', 'Produce a significant self-directed creative work (portfolio, performance, project, written piece). Present and defend creative choices to an audience.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.12-14.2', 'Give and receive constructive critique', 'Provide specific, evidence-based feedback on peers'' creative work. Receive critique with openness and use it to improve.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CE.12-14.3', 'Design and prototype a solution to a real problem', 'Apply design thinking: empathize with users, define the problem, ideate, prototype, and test. Deliver a real or functional solution.', '{}'::jsonb, 12, 14);

    -- Domain IW: Inner Self & Well Being
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Inner Self & Well Being', 'IW', 5)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.4-5.1', 'Identify and name basic emotions', 'Recognize and name common emotions (happy, sad, angry, scared, surprised) in self and others. Use feeling words in conversation.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.4-5.2', 'Follow routines and manage transitions', 'Participate in group settings by following predictable routines. Move between activities without significant distress.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.4-5.3', 'Manage frustration and seek help appropriately', 'Identify when feeling frustrated or overwhelmed and use simple coping strategies (take a breath, ask for help). Begin to self-regulate.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.4-5.4', 'Show care and basic empathy toward others', 'Notice when a peer is upset and offer simple help or comfort. Begin to show empathy through words or actions.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.6-7.1', 'Understand own strengths and areas for growth', 'Identify things they are good at and things they find hard. Show willingness to try challenging tasks without giving up.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.6-7.2', 'Show responsibility for personal tasks', 'Complete assigned responsibilities without constant reminders. Take ownership of mistakes and attempt to fix them.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.6-7.3', 'Recognize emotions and personal triggers', 'Identify what situations tend to trigger strong emotions. Notice physical signals of emotional escalation and apply a calming strategy.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.8-9.1', 'Demonstrate persistence through difficulty', 'Stay engaged with a difficult task without giving up. Use strategies to cope with frustration. Distinguish between effort and fixed ability.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.8-9.2', 'Set and work toward a personal goal', 'Identify a meaningful goal, break it into steps, track progress, and reflect on outcomes.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.8-9.3', 'Show ethical reasoning in decisions', 'Identify ethical dimensions of a decision. Consider impact on self and others. Reflect on personal values as a guide to action.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.10-11.1', 'Understand and manage complex emotions', 'Identify mixed or complex emotions (e.g., proud and embarrassed simultaneously). Use a range of coping strategies. Reflect on emotional patterns over time.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.10-11.2', 'Understand mental health and emotional wellbeing', 'Describe what mental health means. Identify signs of stress, anxiety, and burnout. Know strategies for maintaining wellbeing and when to ask for support.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.10-11.3', 'Develop a growth mindset toward learning', 'Understand that abilities grow through effort and practice. Reframe setbacks as information rather than failure. Seek feedback actively.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.12-14.1', 'Reflect on personal identity and values', 'Articulate personal values, interests, and strengths. Understand how identity is shaped by experience, culture, and relationships.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.12-14.2', 'Manage stress and seek support when needed', 'Recognize signs of stress or overwhelm. Use a range of coping strategies. Reach out to trusted adults or peers appropriately and without shame.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'IW.12-14.3', 'Demonstrate self-directed learning', 'Identify a topic or skill of genuine interest and pursue it independently. Manage time, evaluate progress, and adapt strategies without external prompting.', '{}'::jsonb, 12, 14);

    -- Domain PW: Physical Wellbeing & Movement
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Physical Wellbeing & Movement', 'PW', 6)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.4-5.1', 'Demonstrate gross motor coordination', 'Run, jump, hop, skip, and climb with developing coordination and balance. Participate in active play.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.4-5.2', 'Demonstrate fine motor skills for daily tasks', 'Hold pencils and scissors correctly. Use hands to manipulate small objects, buttons, and fasteners with increasing control.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.4-5.3', 'Understand basic hygiene and self-care', 'Wash hands at appropriate times. Understand basic dental hygiene and personal care routines. Manage own basic needs independently.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.4-5.4', 'Understand basic food groups and healthy eating', 'Identify foods that support health and energy. Understand that a variety of foods is part of a healthy diet.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.6-7.1', 'Participate in structured physical activity', 'Engage with focus and effort in structured games, sports, or movement activities. Follow rules and safety guidelines.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.6-7.2', 'Demonstrate body awareness and spatial control', 'Move safely in shared spaces, adjust speed and direction in response to others, and demonstrate awareness of personal space.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.6-7.3', 'Understand the connection between movement and wellbeing', 'Describe how physical activity affects mood, energy, and sleep. Identify activities they enjoy for their own health and wellbeing.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.8-9.1', 'Develop a physical skill through deliberate practice', 'Set a physical challenge (catching, balancing, a sport skill) and practice it consistently over time. Track and reflect on improvement.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.8-9.2', 'Understand components of physical fitness', 'Identify and describe strength, flexibility, endurance, and coordination. Connect these components to long-term health outcomes.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.8-9.3', 'Make healthy choices in food, sleep, and activity', 'Explain the role of sleep, nutrition, and physical activity in maintaining health. Make deliberate healthy choices in everyday contexts.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.10-11.1', 'Understand puberty and body changes', 'Understand the physical and emotional changes associated with puberty. Know that these are normal developmental processes and vary between individuals.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.10-11.2', 'Develop a personal fitness routine', 'Design and maintain a basic personal fitness plan with varied activity types. Reflect on progress and adjust the plan over time.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.10-11.3', 'Understand online safety and digital wellbeing', 'Identify safe and risky online behaviors. Understand screen time effects on sleep and mood. Know how to respond to online conflict or unwanted contact.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.12-14.1', 'Understand risk, consent, and personal boundaries', 'Articulate concepts of personal boundaries and consent in physical and social contexts. Recognize unsafe situations and know how to respond.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.12-14.2', 'Manage personal health and self-care independently', 'Take initiative for personal health practices including sleep, nutrition, hygiene, and physical activity without adult prompting.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'PW.12-14.3', 'Understand substance use and health consequences', 'Describe the physical and social consequences of substance use. Identify strategies for making safe decisions under social pressure.', '{}'::jsonb, 12, 14);

    -- Domain CR: Collaboration & Relational Skills
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Collaboration & Relational Skills', 'CR', 7)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.4-5.1', 'Take turns and share with others', 'Share materials, take turns in games and activities, and wait without significant distress. Acknowledge others'' right to participate.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.4-5.2', 'Play cooperatively with peers', 'Join group play, contribute to shared goals, and adjust own behavior to fit the group''s needs. Begin to negotiate roles.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.4-5.3', 'Listen actively to others', 'Give full attention when others speak. Avoid interrupting. Ask questions to understand rather than to respond.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.6-7.1', 'Resolve simple conflicts with peers', 'Identify a conflict, listen to another''s perspective, and attempt a fair resolution. Know when to ask an adult for help.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.6-7.2', 'Build and maintain friendships', 'Initiate and sustain positive peer relationships. Show awareness of what makes a good friend. Repair relationships after conflict.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.6-7.3', 'Contribute fairly in group tasks', 'Accept and fulfill a role within a group. Complete the assigned contribution without relying on others to cover it. Acknowledge others'' contributions.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.6-7.4', 'Show empathy and perspective-taking', 'Consider another person''s feelings and viewpoint before responding. Adjust behavior based on awareness of how actions affect others.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.8-9.1', 'Navigate peer pressure and make independent decisions', 'Recognize peer pressure situations. Use assertive communication to express own views while respecting others. Make decisions that align with personal values.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.8-9.2', 'Negotiate and reach shared agreements', 'Identify areas of disagreement within a group, propose compromises, and work toward a solution that acknowledges multiple perspectives.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.8-9.3', 'Give and receive feedback constructively', 'Offer specific, respectful feedback on others'' work or ideas. Receive feedback without defensiveness and use it to improve.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.8-9.4', 'Manage group dynamics and shared accountability', 'Monitor whether the group is on track. Address unequal participation respectfully. Hold self and others accountable without blame.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.10-11.1', 'Analyze problems from multiple perspectives before deciding', 'Understand that complex problems involve multiple stakeholders with different interests. Deliberately seek out perspectives different from your own before forming a conclusion.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.10-11.2', 'Lead and support others in a group', 'Take initiative when needed, support others'' participation, navigate disagreement constructively, and keep a group focused on a shared goal.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.10-11.3', 'Collaborate across difference', 'Work effectively with people who have different backgrounds, communication styles, or opinions. Recognize how difference strengthens group output.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.10-11.4', 'Demonstrate interpersonal integrity', 'Keep commitments made to others. Speak honestly even when it is uncomfortable. Acknowledge mistakes to the group and take corrective action.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.12-14.1', 'Navigate conflict constructively in complex situations', 'Approach serious conflicts with curiosity rather than defensiveness. Use negotiation and mediation strategies. Know when disengagement is the right choice.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.12-14.2', 'Co-create a substantial shared product', 'Plan, produce, and deliver a significant collaborative output (project, performance, publication). Divide work equitably, integrate contributions, and present jointly.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.12-14.3', 'Give feedback that improves group reasoning', 'Identify weaknesses in a group''s shared reasoning or plan. Raise concerns clearly and propose improvements. Distinguish between critiquing ideas and critiquing people.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'CR.12-14.4', 'Build and sustain trust in relationships', 'Understand what builds and erodes trust. Consistently act in ways that are reliable, honest, and respectful over time. Repair trust after it has been broken.', '{}'::jsonb, 12, 14);

    -- Domain GC: Global Citizenship & Contribution
    insert into competency_domains (framework_id, name, code_prefix, display_order)
    values (fw_id, 'Global Citizenship & Contribution', 'GC', 8)
    returning id into domain_id;
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 4-5', 1)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.4-5.1', 'Recognize that people have different backgrounds and traditions', 'Notice and describe differences in how families celebrate, eat, dress, and speak. Show curiosity rather than judgment.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.4-5.2', 'Identify own cultural identity and family practices', 'Describe family traditions, foods, languages, and practices that are meaningful. Connect these to a sense of personal identity.', '{}'::jsonb, 4, 5);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.4-5.3', 'Show respect for people who are different', 'Use respectful language and behavior toward people with different abilities, backgrounds, or appearances. Speak up when someone is treated unkindly.', '{}'::jsonb, 4, 5);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 6-7', 2)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.6-7.1', 'Understand basic community roles and responsibilities', 'Identify community helpers and their roles. Understand that communities depend on people contributing to shared needs.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.6-7.2', 'Understand that the world has many languages and cultures', 'Identify that different countries have different languages, foods, and customs. Show curiosity about cultures beyond their own.', '{}'::jsonb, 6, 7);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.6-7.3', 'Understand basic human rights and fairness', 'Describe what it means for something to be fair or unfair. Identify basic rights that all people should have. Discuss real situations where these are not honored.', '{}'::jsonb, 6, 7);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 8-9', 3)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.8-9.1', 'Understand how geography shapes culture and daily life', 'Explain how climate, location, and resources influence how people live, work, and build communities in different places.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.8-9.2', 'Understand historical events and their causes', 'Explain how past events led to present-day conditions. Identify multiple causes and effects of key historical events.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.8-9.3', 'Communicate across cultural differences', 'Adapt communication style with awareness of cultural norms. Ask questions to understand rather than assuming. Recognize when a misunderstanding may be cultural.', '{}'::jsonb, 8, 9);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.8-9.4', 'Engage with civic processes and democratic participation', 'Understand how rules and laws are made in democratic systems. Participate in class or community decision-making processes. Understand the concept of civic responsibility.', '{}'::jsonb, 8, 9);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 10-11', 4)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.10-11.1', 'Analyze bias and representation in media and texts', 'Identify whose perspectives are included and excluded in a text, image, or media product. Analyze how this shapes understanding of events or groups.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.10-11.2', 'Understand global interdependence', 'Explain how economies, environments, and political systems are interconnected globally. Identify how local actions can have global effects.', '{}'::jsonb, 10, 11);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.10-11.3', 'Investigate a social issue and propose action', 'Research a local or global social issue, evaluate multiple perspectives, and propose an informed course of action or advocacy.', '{}'::jsonb, 10, 11);
    insert into competency_subdomains (domain_id, name, display_order)
    values (domain_id, 'Ages 12-14', 5)
    returning id into subdomain_id;
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.12-14.1', 'Understand systems of power, privilege, and inequality', 'Describe how systems of power have historically distributed advantage and disadvantage. Connect historical patterns to present-day inequalities.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.12-14.2', 'Engage across cultural and ideological difference', 'Engage respectfully and curiously with people who hold significantly different cultural, political, or ideological views. Distinguish disagreement from disrespect.', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.12-14.3', 'Take informed civic action', 'Identify a real community or global need, evaluate options for civic engagement, and take meaningful action (petition, service, advocacy, creative work).', '{}'::jsonb, 12, 14);
    insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors, age_band_start, age_band_end)
    values (subdomain_id, fw_id, 'GC.12-14.4', 'Reflect on own cultural assumptions and biases', 'Identify ways that their own cultural background shapes their assumptions and worldview. Demonstrate willingness to revise assumptions when presented with new information.', '{}'::jsonb, 12, 14);

  return fw_id;
end;
$func$;
