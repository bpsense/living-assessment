-- 047_seed_place_based_templates.sql
-- Seed 5 place-based, culturally immersive PBL project templates.
-- These are school-agnostic: school_id and created_by are populated
-- via a function that copies them into each school on first use.

-- We insert into a single "system" template set using a fixed UUID
-- for school_id. A trigger or app-level logic can clone these into
-- each school's template library.

-- For now, insert directly with the first school found.

DO $$
DECLARE
  v_school_id uuid;
  v_created_by uuid;
BEGIN
  -- Get the first school
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  IF v_school_id IS NULL THEN
    RAISE NOTICE 'No schools found — skipping seed templates.';
    RETURN;
  END IF;

  -- Get the first admin user for that school
  SELECT id INTO v_created_by FROM profiles
    WHERE school_id = v_school_id AND role = 'admin'
    LIMIT 1;
  IF v_created_by IS NULL THEN
    SELECT id INTO v_created_by FROM profiles
      WHERE school_id = v_school_id
      LIMIT 1;
  END IF;

  -- ============================================================
  -- 1. Our Roots, Our Table: A Community Food Story
  -- ============================================================
  INSERT INTO assignment_templates (
    school_id, created_by, title, description, assignment_type,
    competency_ids, skill_ids, is_shared, template_data,
    grade_band, subject_area, estimated_duration_days,
    driving_question, essential_understandings, authenticity_hook,
    final_product, dok_level, phases, choice_points,
    critique_protocol, scaffolding_notes, differentiation,
    materials_and_resources, tags, version, status
  ) VALUES (
    v_school_id,
    v_created_by,
    'Our Roots, Our Table: A Community Food Story',
    'Students investigate local food systems, interview family elders about food traditions, test recipes, and create a community cookbook launched at a potluck feast — exploring how food connects culture, science, and place.',
    'class',
    '{}', '{}', true, '{}',
    'elementary',
    ARRAY['Science', 'Social Studies', 'ELA'],
    21,
    'Where does our food come from, and what do the foods we share tell us about who we are?',
    ARRAY[
      'Food connects people to land, culture, history, and each other.',
      'Every family carries food traditions that reflect their identity and heritage.',
      'Understanding where food comes from helps us make choices that honor the land and our communities.'
    ],
    'Families are co-creators: elders share recipes and stories, the class produces a real cookbook, and the project culminates in a community feast where everyone''s food tradition is celebrated.',
    '{
      "description": "A class community cookbook combining family recipes, food stories, cultural illustrations, and the science of local food — launched at a community potluck feast.",
      "format_options": ["Printed cookbook + potluck feast", "Digital cookbook + virtual food story sharing", "Printed cookbook + food story podcast episodes"],
      "audience": "Families, school community, local community organizations, and elders who contributed",
      "presentation_format": "Community potluck feast with recipe stations and cookbook launch",
      "quality_criteria": [
        "Recipe is accurate, clear, and includes measurements that work",
        "Food story weaves together personal memory, cultural meaning, and place",
        "Illustration reflects the cultural identity connected to the food",
        "Student can share the story behind their dish with guests"
      ]
    }'::jsonb,
    3,
    '[
      {
        "id": "food-p1", "title": "Taste & Wonder",
        "description": "Entry event: a community tasting table where families send in a dish or ingredient that matters to them. Students explore where food comes from and why it matters.",
        "duration_days": 3, "dok_level": 2,
        "activities": [
          {"id": "food-a1", "title": "Community Tasting Circle", "description": "Families contribute a food item with a note about its significance. Students taste, observe, and discuss.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Tasting plates", "Observation journals", "Family invitation letters"], "educator_notes": "Send invitations 2 weeks early. Be sensitive to dietary restrictions and food insecurity."},
          {"id": "food-a2", "title": "Food Memory Map", "description": "Students draw a visual map of foods important in their family — special meals, holiday foods, garden foods.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 40, "resources": ["Large paper", "Colored markers", "Food memory prompt cards"], "educator_notes": "Model with your own food memory map first."},
          {"id": "food-a3", "title": "Wonder Wall", "description": "Generate questions about food: Where does it grow? Who grows it here? What did our grandparents eat?", "activity_type": "investigation", "is_required": true, "estimated_minutes": 30, "resources": ["Sticky notes", "Wonder Wall poster"], "educator_notes": "Group questions into themes for the investigation phase."}
        ],
        "reflection_prompts": ["What food connects you most strongly to your family or culture? Why?", "What surprised you about the foods your classmates shared?"],
        "checkpoint": null
      },
      {
        "id": "food-p2", "title": "Investigate & Harvest",
        "description": "Research local food systems, interview family elders about food traditions, visit local farms or gardens, and study the science of growing food in this place.",
        "duration_days": 8, "dok_level": 3,
        "activities": [
          {"id": "food-a4", "title": "Elder Food Interview", "description": "Interview a family elder about food traditions: What did they eat growing up? What recipes have been passed down?", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Interview guide", "Recording device", "Thank-you card supplies"], "educator_notes": "Provide interview guides in families'' home languages."},
          {"id": "food-a5", "title": "Local Food System Investigation", "description": "Research where food comes from: visit a local farm, garden, market, or food bank. Map the journey of a food item.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 90, "resources": ["Field trip forms", "Food journey mapping template"], "educator_notes": "Partner with a local farm or farmers market."},
          {"id": "food-a6", "title": "Soil & Seed Science", "description": "Test garden soil, plant seeds, observe germination. Connect to the science of how food grows in this climate.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 90, "resources": ["Soil test kits", "Seeds", "Planting containers", "Science journals"], "educator_notes": "Choose seeds that connect to students'' cultures when possible."},
          {"id": "food-a7", "title": "Recipe Documentation", "description": "Document a family recipe with precise measurements, cultural context, and the story behind the dish.", "activity_type": "creation", "is_required": true, "estimated_minutes": 60, "resources": ["Recipe template", "Measurement tools"], "educator_notes": "Honor oral traditions — help students convert approximate measures."}
        ],
        "reflection_prompts": ["What did you learn from your elder that you didn''t know before?", "How is the way your family gets food different from 50 years ago?"],
        "checkpoint": {"title": "Research Portfolio Check", "description": "Educator reviews interview notes, food journey map, science observations, and documented recipe.", "assessment_type": "educator_check", "competency_ids": [], "criteria": ["Elder interview completed", "Food journey mapped", "Science investigation documented", "Family recipe recorded with cultural context"]}
      },
      {
        "id": "food-p3", "title": "Cook & Create",
        "description": "Develop the community cookbook: test and refine recipes, write food stories, create illustrations, and design the book together.",
        "duration_days": 7, "dok_level": 3,
        "activities": [
          {"id": "food-a8", "title": "Test Kitchen Day", "description": "Students prepare their family recipe for classmates. Practice measurement, sequencing, and food safety.", "activity_type": "creation", "is_required": true, "estimated_minutes": 120, "resources": ["Kitchen access", "Ingredients", "Food safety guidelines", "Tasting feedback forms"], "educator_notes": "Coordinate with school kitchen. Address allergies carefully."},
          {"id": "food-a9", "title": "Food Story Writing", "description": "Write the story behind the recipe: who taught it, when it''s made, what it means, how it connects to culture and place.", "activity_type": "creation", "is_required": true, "estimated_minutes": 90, "resources": ["Writing prompts", "Mentor food stories", "Revision checklist"], "educator_notes": "Share mentor texts from food writers who connect food to culture."},
          {"id": "food-a10", "title": "Illustration & Photography", "description": "Create visual art for the cookbook: watercolor illustrations, photographs, or cultural artwork.", "activity_type": "creation", "is_required": true, "estimated_minutes": 60, "resources": ["Art supplies", "Cameras or tablets"], "educator_notes": "Encourage cultural motifs and patterns from heritage."},
          {"id": "food-a11", "title": "Peer Critique", "description": "Peer feedback on recipes and food stories using I Notice / I Wonder / What If protocol.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 45, "resources": ["Feedback protocol sheets"], "educator_notes": "Focus on both recipe clarity and story voice."}
        ],
        "reflection_prompts": ["What was it like to share your family''s food with classmates?", "How does writing about food help preserve cultural traditions?"],
        "checkpoint": {"title": "Peer Recipe & Story Review", "description": "Peer feedback on draft recipes and food stories.", "assessment_type": "peer_review", "competency_ids": [], "criteria": ["Recipe is clear and repeatable", "Food story conveys cultural meaning", "Peer feedback incorporated"]}
      },
      {
        "id": "food-p4", "title": "Feast & Share",
        "description": "Community potluck feast and cookbook launch.",
        "duration_days": 3, "dok_level": 4,
        "activities": [
          {"id": "food-a12", "title": "Cookbook Assembly", "description": "Compile all recipes, stories, and illustrations into a class cookbook.", "activity_type": "creation", "is_required": true, "estimated_minutes": 90, "resources": ["Book binding supplies or digital publishing tool"], "educator_notes": "Print copies for every family."},
          {"id": "food-a13", "title": "Community Feast", "description": "Host a potluck where families bring dishes from the cookbook. Students share the story behind their dish.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 120, "resources": ["Table setup", "Recipe station cards", "Cookbook copies", "Multilingual signs"], "educator_notes": "Make this a celebration. Provide food for families who cannot bring a dish."},
          {"id": "food-a14", "title": "Gratitude Circle", "description": "What did food teach us about each other? Write thank-you notes to elders.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 30, "resources": ["Thank-you cards", "Talking piece"], "educator_notes": "Honor the emotional weight of this project."}
        ],
        "reflection_prompts": ["What does food teach us about culture that words alone cannot?", "What will you remember most from this project?"],
        "checkpoint": {"title": "Feast Reflection", "description": "Self-assessment of learning journey.", "assessment_type": "self_assessment", "competency_ids": [], "criteria": ["Cookbook contribution complete", "Food story connects recipe to culture", "Student can articulate what they learned"]}
      }
    ]'::jsonb,
    '[
      {"phase_id": "food-p2", "description": "Choose which food tradition to investigate.", "choice_type": "topic_selection", "options": ["A holiday dish", "An everyday comfort food", "A food from a family garden", "A recipe passed down through generations"]},
      {"phase_id": "food-p2", "description": "Choose investigation method for local food systems.", "choice_type": "research_method", "options": ["Farm or garden visit", "Farmers market investigation", "Grocery store supply chain research", "School garden experiment"]},
      {"phase_id": "food-p3", "description": "Choose how to illustrate your cookbook page.", "choice_type": "product_format", "options": ["Watercolor illustration", "Photography", "Cultural pattern artwork", "Mixed media collage"]}
    ]'::jsonb,
    'I Notice / I Wonder / What If — applied to both recipes (as functional texts) and food stories (as cultural narratives).',
    'Begin with the tasting circle to build trust. Front-load interview skills before elder conversations. Model recipe writing with a shared class recipe. Honor oral traditions by allowing storytelling before writing.',
    '{
      "extending": "Research agricultural history of the region. Compare traditional and industrial food systems. Create a food justice section.",
      "supporting": "Provide recipe templates with sentence starters. Pair students for interviews. Offer photo-based food story alternatives.",
      "ell_accommodations": "Conduct elder interviews in home language. Accept bilingual recipes and stories. Provide visual vocabulary for cooking terms.",
      "accessibility_notes": "Offer sensory-safe tasting alternatives. Provide adaptive cooking tools. Allow digital illustration tools."
    }'::jsonb,
    '[
      {"title": "StoryCorps Great Questions", "type": "link", "url": "https://storycorps.org/participate/great-questions/", "notes": "Adapt for food-focused elder interviews."},
      {"title": "Recipe Template with Cultural Context", "type": "printable", "url": null, "notes": "Structured template: ingredients, steps, and the story behind the dish."},
      {"title": "Book Creator", "type": "tool", "url": "https://bookcreator.com", "notes": "Digital tool for assembling the class cookbook."}
    ]'::jsonb,
    ARRAY['place-based', 'culturally-immersive', 'food', 'community', 'science', 'oral-history', 'elementary'],
    1,
    'published'
  );

  -- ============================================================
  -- 2. Guardians of This Place: Caring for Our Land
  -- ============================================================
  INSERT INTO assignment_templates (
    school_id, created_by, title, description, assignment_type,
    competency_ids, skill_ids, is_shared, template_data,
    grade_band, subject_area, estimated_duration_days,
    driving_question, essential_understandings, authenticity_hook,
    final_product, dok_level, phases, choice_points,
    critique_protocol, scaffolding_notes, differentiation,
    materials_and_resources, tags, version, status
  ) VALUES (
    v_school_id,
    v_created_by,
    'Guardians of This Place: Caring for Our Land',
    'Students investigate the ecology of their school grounds, learn from community elders and knowledge holders about cultural relationships with land, and design and implement a real stewardship project that honors both science and tradition.',
    'class',
    '{}', '{}', true, '{}',
    'upper_elementary',
    ARRAY['Science', 'Social Studies'],
    21,
    'How have the people of this place cared for the land, and what is our responsibility to carry that forward?',
    ARRAY[
      'Every place has a story — shaped by the people who have lived there and the ecological systems that sustain it.',
      'Scientific knowledge and cultural knowledge are both essential for understanding and caring for land.',
      'Stewardship means taking active responsibility for the health of the places we belong to.'
    ],
    'Students create a REAL, lasting change on their school grounds or in their community, informed by community knowledge holders and resulting in a physical space that benefits people and ecosystems.',
    '{"description": "A real land stewardship project implemented on school grounds, combining ecological science with cultural land-care knowledge, celebrated through a community dedication ceremony.", "format_options": ["Garden/restoration + dedication ceremony", "Garden/restoration + documentary video"], "audience": "School community, families, local environmental organizations, and community knowledge holders", "presentation_format": "Community land dedication ceremony with student presentations and ongoing stewardship plan", "quality_criteria": ["Project addresses genuine ecological need", "Design integrates scientific and cultural knowledge", "Students can explain reasoning behind choices", "Community voice authentically incorporated"]}'::jsonb,
    3,
    '[
      {"id": "land-p1", "title": "Walk & Notice", "description": "Slow, intentional walks through school grounds. Students practice deep observation through nature journaling.", "duration_days": 4, "dok_level": 2, "activities": [{"id": "land-a1", "title": "Silent Sit Spot", "description": "Each student finds a spot and sits silently for 10 minutes, observing with all senses.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 30, "resources": ["Nature journals"], "educator_notes": "Practice 3 times. Return to the SAME spot."},{"id": "land-a2", "title": "Land Story Circle", "description": "Circle outdoors: Who has lived on this land? How did they care for it?", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 40, "resources": ["Talking piece", "Historical land map"], "educator_notes": "Research indigenous history beforehand."},{"id": "land-a3", "title": "Neighborhood Land Walk", "description": "Walk the area observing land use: gardens, parks, paved areas, waterways, wild spaces.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Clipboards", "Cameras", "Land use observation sheet"], "educator_notes": "Walk slowly. Ask what this land might have looked like 100 years ago."}], "reflection_prompts": ["What did you notice at your sit spot that you never noticed before?", "What does caring for the land mean to your family or culture?"], "checkpoint": null},
      {"id": "land-p2", "title": "Listen & Learn", "description": "Learn from community knowledge holders and conduct ecological surveys.", "duration_days": 7, "dok_level": 3, "activities": [{"id": "land-a4", "title": "Community Knowledge Holder Visit", "description": "Invite someone with deep knowledge of this land to share how people have cared for this place.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Guest invitation", "Thank-you gift"], "educator_notes": "Reach out to local indigenous organizations or environmental groups."},{"id": "land-a5", "title": "Ecological Survey", "description": "Biodiversity survey: count plant species, identify insects, test soil pH.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 90, "resources": ["Plant ID guides", "Soil test kits", "Data sheets"], "educator_notes": "Learn both scientific and cultural names for plants."},{"id": "land-a6", "title": "Family Land Knowledge Interview", "description": "Interview a family member about their relationship with land.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 45, "resources": ["Interview guide"], "educator_notes": "Frame the interview to honor family land knowledge as expertise."},{"id": "land-a7", "title": "Historical Land Research", "description": "Research how this land has changed over time using maps, photos, and archives.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 60, "resources": ["Historical maps", "Local history archives"], "educator_notes": "Use Native Land Digital (native-land.ca) as a starting point."}], "reflection_prompts": ["What land-care practice resonated with you most?", "What knowledge does your family carry about caring for land?"], "checkpoint": {"title": "Knowledge Portfolio Review", "description": "Educator reviews ecological data, interview notes, and research.", "assessment_type": "educator_check", "competency_ids": [], "criteria": ["Ecological survey completed", "Interview documented", "Historical changes identified"]}},
      {"id": "land-p3", "title": "Design & Plan", "description": "Design a land stewardship project integrating scientific data, community input, and cultural knowledge.", "duration_days": 6, "dok_level": 4, "activities": [{"id": "land-a8", "title": "Problem Identification Workshop", "description": "Using data and community knowledge, identify a specific land-care need.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 60, "resources": ["Survey data", "Community input notes"], "educator_notes": "Guide students to choose something achievable."},{"id": "land-a9", "title": "Stewardship Plan Design", "description": "Teams design the project: site map, plant selection, timeline, materials, maintenance plan.", "activity_type": "creation", "is_required": true, "estimated_minutes": 120, "resources": ["Graph paper", "Native plant guides", "Budget worksheet"], "educator_notes": "Include culturally significant plants alongside native species."},{"id": "land-a10", "title": "Community Feedback Session", "description": "Present draft plans to community members for feedback. Revise.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 60, "resources": ["Presentation materials", "Feedback forms"], "educator_notes": "Invite knowledge holders back for their feedback."}], "reflection_prompts": ["How does your design honor both science and cultural knowledge?", "How will this benefit people and the land in 10 years?"], "checkpoint": {"title": "Community Design Review", "description": "Community members review stewardship plans.", "assessment_type": "group_critique", "competency_ids": [], "criteria": ["Design addresses real need", "Cultural and scientific knowledge integrated", "Community feedback incorporated"]}},
      {"id": "land-p4", "title": "Plant & Celebrate", "description": "Implement the project and celebrate with a land dedication ceremony.", "duration_days": 4, "dok_level": 3, "activities": [{"id": "land-a11", "title": "Implementation Day", "description": "Hands-on: plant native species, build beds, install signage. Community volunteers welcome.", "activity_type": "creation", "is_required": true, "estimated_minutes": 180, "resources": ["Plants", "Soil", "Garden tools", "Signage materials"], "educator_notes": "Invite families. Play music. Document with photos."},{"id": "land-a12", "title": "Land Dedication & Storytelling", "description": "Host a ceremony to dedicate the project. Students share what they learned.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 60, "resources": ["Ceremony program", "Dedication plaque"], "educator_notes": "Let students design the ceremony."},{"id": "land-a13", "title": "Stewardship Pledge", "description": "Write a personal stewardship pledge for ongoing care.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 30, "resources": ["Pledge cards", "Reflection journals"], "educator_notes": "Create a maintenance schedule."}], "reflection_prompts": ["What does it mean to be a guardian of a place?", "What responsibility do you feel toward this land now?"], "checkpoint": {"title": "Stewardship Self-Assessment", "description": "Reflection on learning and land-care commitment.", "assessment_type": "self_assessment", "competency_ids": [], "criteria": ["Can explain ecological reasoning", "Can describe cultural knowledge that informed the project", "Demonstrates personal connection to stewardship"]}}
    ]'::jsonb,
    '[
      {"phase_id": "land-p2", "description": "Choose ecological investigation focus.", "choice_type": "topic_selection", "options": ["Soil health", "Plant biodiversity", "Pollinator census", "Water flow mapping", "Bird observation"]},
      {"phase_id": "land-p3", "description": "Choose stewardship project type.", "choice_type": "topic_selection", "options": ["Native plant garden", "Rain garden", "Outdoor classroom", "Composting system", "Habitat restoration"]},
      {"phase_id": "land-p4", "description": "Choose how to share the project story.", "choice_type": "presentation_style", "options": ["Land dedication ceremony", "Documentary video", "Illustrated field guide", "Photo essay"]}
    ]'::jsonb,
    'Community Design Review: knowledge holders and community members give feedback on stewardship plans.',
    'Begin with sit spot practice to develop observation. Build cultural respect before knowledge holder visit. Use ecological surveys to ground the project in data.',
    '{"extending": "Research traditional ecological knowledge (TEK). Create a seasonal stewardship calendar.", "supporting": "Provide visual plant ID cards. Use structured observation templates. Simplify the design plan.", "ell_accommodations": "Learn plant names in students'' home languages. Conduct family interviews in home language. Provide visual glossaries.", "accessibility_notes": "Ensure sit spots are accessible. Provide raised garden beds. Offer sensory-rich observation alternatives."}'::jsonb,
    '[
      {"title": "Native Land Digital", "type": "link", "url": "https://native-land.ca", "notes": "Interactive map of indigenous territories."},
      {"title": "Sit Spot Nature Journal", "type": "printable", "url": null, "notes": "Structured journal for repeated observation."},
      {"title": "Ecological Survey Data Sheets", "type": "printable", "url": null, "notes": "Templates for plant counts, soil pH, insect tallies."}
    ]'::jsonb,
    ARRAY['place-based', 'culturally-immersive', 'ecology', 'stewardship', 'indigenous-knowledge', 'garden', 'upper-elementary'],
    1,
    'published'
  );

  -- ============================================================
  -- 3. Voices of Our Place: A Living Community Atlas
  -- ============================================================
  INSERT INTO assignment_templates (
    school_id, created_by, title, description, assignment_type,
    competency_ids, skill_ids, is_shared, template_data,
    grade_band, subject_area, estimated_duration_days,
    driving_question, essential_understandings, authenticity_hook,
    final_product, dok_level, phases, choice_points,
    critique_protocol, scaffolding_notes, differentiation,
    materials_and_resources, tags, version, status
  ) VALUES (
    v_school_id,
    v_created_by,
    'Voices of Our Place: A Living Community Atlas',
    'Students explore their neighborhood, conduct oral history interviews with community members, and create a Living Community Atlas — a published collection of maps, stories, photographs, and art documenting the cultural significance of local places.',
    'class',
    '{}', '{}', true, '{}',
    'upper_elementary',
    ARRAY['Social Studies', 'ELA', 'Art'],
    22,
    'What stories, memories, and meanings live in the places around us, and how can we make sure they are never lost?',
    ARRAY[
      'Every place holds layers of human story — and those stories shape community identity.',
      'Oral history is a powerful way to preserve knowledge that written records often miss.',
      'When we listen to the stories of a place, we learn to see our community with new eyes.'
    ],
    'Students produce a real, published atlas gifted back to the community. Interviewees see their stories honored in print. The atlas becomes a lasting community resource.',
    '{"description": "A Living Community Atlas — a collection of oral histories, photographs, artwork, and maps documenting culturally significant local places.", "format_options": ["Printed atlas + launch event", "Interactive digital atlas + community event"], "audience": "Community interviewees, families, school library, local historical society", "presentation_format": "Community atlas launch event with student presentations and atlas distribution", "quality_criteria": ["Entries preserve interviewees'' voices with respect", "Stories connected to places through maps and photos", "Atlas represents community diversity", "Visual design reflects cultural richness"]}'::jsonb,
    3,
    '[
      {"id": "atlas-p1", "title": "Wander & Map", "description": "Explore the neighborhood, identify places that hold meaning.", "duration_days": 4, "dok_level": 2, "activities": [{"id": "atlas-a1", "title": "Neighborhood Story Walk", "description": "Walk through the community. At each stop ask: Who gathers here? What stories might this place hold?", "activity_type": "field_work", "is_required": true, "estimated_minutes": 75, "resources": ["Walking route map", "Cameras", "Observation notebooks"], "educator_notes": "Walk slowly. Stop at ordinary places — the corner store, the park bench."},{"id": "atlas-a2", "title": "My Place Map", "description": "Each student creates a personal map of places that matter to them.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 45, "resources": ["Large paper", "Colored markers"], "educator_notes": "This is about meaning, not accuracy."},{"id": "atlas-a3", "title": "Class Story Map", "description": "Overlay individual maps onto a class map. Notice clusters of meaning.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 40, "resources": ["Large neighborhood base map", "Colored pins"], "educator_notes": "Let students decide which places to investigate."}], "reflection_prompts": ["What place on your map holds the strongest memories?", "Are there places whose stories might be forgotten?"], "checkpoint": null},
      {"id": "atlas-p2", "title": "Listen & Record", "description": "Conduct oral history interviews with community members.", "duration_days": 8, "dok_level": 3, "activities": [{"id": "atlas-a4", "title": "Oral History Training", "description": "Learn interviewing techniques from the StoryCorps model.", "activity_type": "skill_building", "is_required": true, "estimated_minutes": 60, "resources": ["StoryCorps question list", "Recording equipment", "Consent forms"], "educator_notes": "Practice interviews in class first. Emphasize respect and consent."},{"id": "atlas-a5", "title": "Community Oral History Interviews", "description": "In pairs, interview community members about a specific place.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 90, "resources": ["Recording device", "Camera", "Interview guide", "Consent forms"], "educator_notes": "Help students identify interviewees through family networks."},{"id": "atlas-a6", "title": "Site Documentation", "description": "Return to each story place for detailed documentation: photos, sketches, descriptions.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 60, "resources": ["Camera", "Sketch pad", "GPS or mapping app"], "educator_notes": "Teach basic documentary photography."}], "reflection_prompts": ["Whose stories are well-known? Whose are hidden?", "How does a place hold memory?"], "checkpoint": {"title": "Story Collection Review", "description": "Educator reviews recordings, photos, and documentation.", "assessment_type": "educator_check", "competency_ids": [], "criteria": ["Interview completed and recorded", "Story place documented", "Consent obtained", "Key themes identified"]}},
      {"id": "atlas-p3", "title": "Weave & Build", "description": "Transform interviews into atlas entries. Build the community atlas.", "duration_days": 7, "dok_level": 3, "activities": [{"id": "atlas-a7", "title": "Story Crafting", "description": "Shape interview materials into a compelling atlas entry.", "activity_type": "creation", "is_required": true, "estimated_minutes": 120, "resources": ["Story crafting template", "Interview notes", "Photos"], "educator_notes": "Preserve the interviewee''s voice. Students are scribes, not authors."},{"id": "atlas-a8", "title": "Atlas Art & Design", "description": "Create visual art: illustrated maps, portraits, cultural motifs.", "activity_type": "creation", "is_required": true, "estimated_minutes": 90, "resources": ["Art supplies", "Portrait drawing guides"], "educator_notes": "The atlas should reflect visual diversity."},{"id": "atlas-a9", "title": "Atlas Assembly & Peer Review", "description": "Assemble entries into a cohesive atlas. Review for accuracy and respect.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 90, "resources": ["Atlas layout templates", "Peer review checklist"], "educator_notes": "Ensure every community in the classroom is represented."}], "reflection_prompts": ["What responsibility comes with telling someone else''s story?", "How does organizing stories on a map change how we see our community?"], "checkpoint": {"title": "Peer Atlas Review", "description": "Peer feedback on atlas entries.", "assessment_type": "peer_review", "competency_ids": [], "criteria": ["Entry preserves interviewee''s voice", "Photos and art complement the narrative", "Entry treats subject with dignity"]}},
      {"id": "atlas-p4", "title": "Unveil & Gift", "description": "Launch the atlas at a public event. Gift copies to the community.", "duration_days": 3, "dok_level": 4, "activities": [{"id": "atlas-a10", "title": "Atlas Launch Event", "description": "Community unveiling. Students present entries, interviewees are honored.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 90, "resources": ["Printed atlas copies", "Display setup", "Guest invitations"], "educator_notes": "Every interviewee should receive a copy."},{"id": "atlas-a11", "title": "Thank-You & Reciprocity", "description": "Write thank-you letters. Discuss what we gave back to the community.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 40, "resources": ["Thank-you card supplies"], "educator_notes": "Reciprocity is a core value."},{"id": "atlas-a12", "title": "Legacy & Continuation", "description": "Plan how to keep the atlas alive: digital version, annual additions.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 30, "resources": ["Digital publishing platform"], "educator_notes": "Set up for future classes to add entries."}], "reflection_prompts": ["What will this atlas mean to our community 20 years from now?", "What story would you want someone to tell about YOUR life and place?"], "checkpoint": {"title": "Atlas Launch Reflection", "description": "Self-assessment of the full learning journey.", "assessment_type": "self_assessment", "competency_ids": [], "criteria": ["Atlas entry is polished and respectful", "Student can articulate what they learned", "Student understands responsibility of storytelling"]}}
    ]'::jsonb,
    '[
      {"phase_id": "atlas-p1", "description": "Choose which story places to investigate.", "choice_type": "topic_selection", "options": ["A place of gathering", "A cultural landmark", "A business with a story", "A natural feature", "A place that has changed"]},
      {"phase_id": "atlas-p2", "description": "Choose who to interview.", "choice_type": "research_method", "options": ["A longtime resident", "A business owner", "A community organizer", "An artist or cultural practitioner", "A family member"]},
      {"phase_id": "atlas-p3", "description": "Choose atlas entry format.", "choice_type": "product_format", "options": ["Written narrative + photographs", "Audio story + illustrated map", "Video mini-documentary", "Photo essay + transcript"]}
    ]'::jsonb,
    'Respectful Representation Review: Does this entry honor the person who shared? Is the interviewee''s voice present?',
    'Start with personal place maps. Practice interview skills extensively. Model story crafting. Discuss ethics of representation throughout.',
    '{"extending": "Compare community stories to official records. Analyze whose stories are missing. Create a companion podcast.", "supporting": "Provide interview question banks. Pair students. Use photo-based story prompts. Allow audio entries.", "ell_accommodations": "Conduct interviews in home languages. Provide bilingual atlas entries. Partner bilingual students as interpreter-interviewers.", "accessibility_notes": "Ensure walking routes are accessible. Provide digital mapping alternatives. Allow audio/video entries."}'::jsonb,
    '[
      {"title": "StoryCorps Interview Guide", "type": "link", "url": "https://storycorps.org/participate/great-questions/", "notes": "Open-ended questions for oral history interviews."},
      {"title": "Google My Maps", "type": "tool", "url": "https://www.google.com/maps/d/", "notes": "Free tool for creating interactive maps."},
      {"title": "Atlas Entry Template", "type": "printable", "url": null, "notes": "Place name, location, story summary, key quotes, photos."}
    ]'::jsonb,
    ARRAY['place-based', 'culturally-immersive', 'oral-history', 'community-mapping', 'atlas', 'upper-elementary'],
    1,
    'published'
  );

  -- ============================================================
  -- 4. Rhythm of Our People: Music, Movement, and Memory
  -- ============================================================
  INSERT INTO assignment_templates (
    school_id, created_by, title, description, assignment_type,
    competency_ids, skill_ids, is_shared, template_data,
    grade_band, subject_area, estimated_duration_days,
    driving_question, essential_understandings, authenticity_hook,
    final_product, dok_level, phases, choice_points,
    critique_protocol, scaffolding_notes, differentiation,
    materials_and_resources, tags, version, status
  ) VALUES (
    v_school_id,
    v_created_by,
    'Rhythm of Our People: Music, Movement, and Memory',
    'Students explore the musical traditions of their families and community, interview family musicians and cultural practitioners, compose original music inspired by their heritage, and perform at a community concert celebrating cultural diversity through sound.',
    'class',
    '{}', '{}', true, '{}',
    'mixed',
    ARRAY['Music', 'Social Studies', 'ELA'],
    20,
    'How does the music of our families and community carry the stories, struggles, and celebrations of who we are?',
    ARRAY[
      'Music is a universal human practice that carries cultural identity, memory, and emotion across generations.',
      'Every musical tradition has roots in the lived experience of a people and a place.',
      'When we share our music, we share the deepest parts of who we are.'
    ],
    'Families and community musicians are central to every phase — as interviewees, guest performers, and audience. The concert is a genuine cultural celebration.',
    '{"description": "An original musical composition inspired by family and cultural traditions, performed at a community concert celebrating musical diversity.", "format_options": ["Live concert + printed program", "Concert + recorded album", "Concert + documentary video"], "audience": "Families, community musicians, school community, and cultural organizations", "presentation_format": "Community concert with cultural program notes and family musician participation", "quality_criteria": ["Composition draws from personal/cultural traditions", "Program note explains cultural context", "Performance communicates meaning", "Student understands how music carries cultural memory"]}'::jsonb,
    3,
    '[
      {"id": "music-p1", "title": "Listen & Share", "description": "Build a musical autobiography. Explore the music that matters in families and cultures.", "duration_days": 3, "dok_level": 2, "activities": [{"id": "music-a1", "title": "Musical Autobiography", "description": "Students bring a song that matters to their family or culture. Share in small groups.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 60, "resources": ["Audio playback device", "Musical autobiography template"], "educator_notes": "Create a safe space. All music traditions are valid."},{"id": "music-a2", "title": "Sound Walk", "description": "Walk the school and neighborhood listening intentionally. Record sounds.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 40, "resources": ["Recording devices", "Sound journal"], "educator_notes": "Walk in silence. Record natural and human-made sounds."},{"id": "music-a3", "title": "Our Classroom Soundtrack", "description": "Compile a collaborative playlist of culturally significant songs.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 30, "resources": ["Collaborative playlist tool"], "educator_notes": "This playlist grows throughout the project."}], "reflection_prompts": ["What does your family''s music tell the world about who you are?", "How does music carry things that words alone cannot?"], "checkpoint": null},
      {"id": "music-p2", "title": "Discover & Research", "description": "Investigate musical traditions through family interviews and community musicians.", "duration_days": 7, "dok_level": 3, "activities": [{"id": "music-a4", "title": "Family Music Interview", "description": "Interview a family member about musical traditions: songs from childhood, instruments, celebration music.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Music-focused interview guide", "Recording device"], "educator_notes": "Broaden the definition of music: humming, clapping games, whistling."},{"id": "music-a5", "title": "Community Musician Visit", "description": "Invite a local musician to share their craft and discuss music and community.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 60, "resources": ["Guest musician invitation", "Performance space"], "educator_notes": "Seek musicians representing classroom diversity. Compensate when possible."},{"id": "music-a6", "title": "Music & History Research", "description": "Research musical traditions connected to students'' cultures: origins, instruments, stories music carried.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 60, "resources": ["Research template", "Listening stations"], "educator_notes": "Connect music to historical context."},{"id": "music-a7", "title": "Musical Elements Study", "description": "Learn rhythm, melody, dynamics, tempo. Analyze how these work in cultural music.", "activity_type": "skill_building", "is_required": true, "estimated_minutes": 45, "resources": ["Musical elements chart", "Instruments or body percussion"], "educator_notes": "Use songs from the class playlist as analysis texts."}], "reflection_prompts": ["What did your family interview reveal that you didn''t know?", "What musical elements are common across different cultures?"], "checkpoint": {"title": "Music Research Review", "description": "Educator reviews interview notes and musical analysis.", "assessment_type": "educator_check", "competency_ids": [], "criteria": ["Family interview completed", "Musical tradition researched with historical connections", "Musical elements identified"]}},
      {"id": "music-p3", "title": "Compose & Create", "description": "Create original compositions drawing from family traditions and community sounds.", "duration_days": 7, "dok_level": 4, "activities": [{"id": "music-a8", "title": "Composition Workshop", "description": "Create an original piece weaving cultural traditions with community sounds.", "activity_type": "creation", "is_required": true, "estimated_minutes": 150, "resources": ["Instruments", "Recording equipment", "Digital music tools"], "educator_notes": "Musical literacy NOT required. Voice, body percussion, found objects all work."},{"id": "music-a9", "title": "Story & Context Writing", "description": "Write the story behind the composition — the program note for the concert.", "activity_type": "creation", "is_required": true, "estimated_minutes": 45, "resources": ["Program note template"], "educator_notes": "These notes bridge the music and the audience."},{"id": "music-a10", "title": "Rehearsal & Peer Feedback", "description": "Perform works-in-progress. Use I heard / I felt / I wondered protocol.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 60, "resources": ["Peer feedback cards", "Performance space"], "educator_notes": "Focus on emotional impact, not technical skill."}], "reflection_prompts": ["How does your composition connect to your family''s traditions?", "How did peer feedback change your piece?"], "checkpoint": {"title": "Peer Performance Review", "description": "Peer feedback on compositions.", "assessment_type": "peer_review", "competency_ids": [], "criteria": ["Composition draws from cultural traditions", "Piece communicates meaning", "Program note explains inspiration", "Peer feedback considered"]}},
      {"id": "music-p4", "title": "Perform & Celebrate", "description": "Community concert celebrating cultural diversity through sound.", "duration_days": 3, "dok_level": 3, "activities": [{"id": "music-a11", "title": "Concert Preparation", "description": "Finalize compositions, design program, rehearse.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 90, "resources": ["Performance space", "Concert program template"], "educator_notes": "Include audience participation moments. Make programs multilingual."},{"id": "music-a12", "title": "Community Concert", "description": "Perform for families and community. Family musicians invited to contribute.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 90, "resources": ["Sound system", "Programs", "Recording equipment"], "educator_notes": "This should feel like a cultural celebration, not a formal recital."},{"id": "music-a13", "title": "Listening Circle & Gratitude", "description": "Listen to concert recordings. What did we learn through music? Write thank-yous.", "activity_type": "reflection", "is_required": true, "estimated_minutes": 30, "resources": ["Concert recordings", "Thank-you cards"], "educator_notes": "Music opens emotional doors. Give students time to process."}], "reflection_prompts": ["What did it feel like to share your music with the community?", "How does music build bridges between people from different cultures?"], "checkpoint": {"title": "Concert Self-Assessment", "description": "Reflection on the full musical journey.", "assessment_type": "self_assessment", "competency_ids": [], "criteria": ["Composition reflects cultural inspiration", "Performance communicates to audience", "Student can articulate how music connects culture and community"]}}
    ]'::jsonb,
    '[
      {"phase_id": "music-p2", "description": "Choose which musical tradition to research.", "choice_type": "topic_selection", "options": ["A family lullaby", "Celebration music", "Work songs", "Music of resistance", "Worship or spiritual music", "Dance music"]},
      {"phase_id": "music-p3", "description": "Choose composition format.", "choice_type": "product_format", "options": ["Song with lyrics", "Instrumental piece", "Community soundscape", "Spoken word with music", "Rhythm and percussion piece", "Digital composition"]},
      {"phase_id": "music-p4", "description": "Choose concert presentation style.", "choice_type": "presentation_style", "options": ["Live performance", "Recorded piece with live intro", "Performance with visual art", "Interactive piece"]}
    ]'::jsonb,
    'I Heard / I Felt / I Wondered: feedback focuses on emotional impact and cultural authenticity, not technical perfection.',
    'Start with listening and sharing. Front-load musical autobiography so every tradition is valued. Provide musical building blocks for students without composition experience.',
    '{"extending": "Research musicology of a tradition in depth. Compose a multi-movement suite. Create a mini-documentary.", "supporting": "Provide rhythm templates. Use body percussion and found objects. Allow group performances.", "ell_accommodations": "Songs in home languages are celebrated. Provide music vocabulary in students'' languages. Allow spoken introductions in home language.", "accessibility_notes": "Provide adaptive instruments and digital tools. Offer visual rhythm cues. Allow pre-recorded performances."}'::jsonb,
    '[
      {"title": "Soundtrap by Spotify", "type": "tool", "url": "https://www.soundtrap.com", "notes": "Collaborative online music studio."},
      {"title": "Musical Autobiography Template", "type": "printable", "url": null, "notes": "Songs of my family, sounds of my place, music that makes me feel."},
      {"title": "Concert Program Template", "type": "printable", "url": null, "notes": "Bilingual template with space for cultural program notes."}
    ]'::jsonb,
    ARRAY['place-based', 'culturally-immersive', 'music', 'oral-history', 'performance', 'community', 'mixed-grades'],
    1,
    'published'
  );

  -- ============================================================
  -- 5. Building Together: Designing Spaces Our Community Needs
  -- ============================================================
  INSERT INTO assignment_templates (
    school_id, created_by, title, description, assignment_type,
    competency_ids, skill_ids, is_shared, template_data,
    grade_band, subject_area, estimated_duration_days,
    driving_question, essential_understandings, authenticity_hook,
    final_product, dok_level, phases, choice_points,
    critique_protocol, scaffolding_notes, differentiation,
    materials_and_resources, tags, version, status
  ) VALUES (
    v_school_id,
    v_created_by,
    'Building Together: Designing Spaces Our Community Needs',
    'Students survey community needs, study how different cultures gather, apply math and spatial reasoning, and design a culturally responsive community space — presenting scale models and proposals to real community stakeholders.',
    'class',
    '{}', '{}', true, '{}',
    'middle_school',
    ARRAY['Math', 'Social Studies', 'Art'],
    20,
    'What spaces does our community need, and how can we design them so they honor who we are and how we gather?',
    ARRAY[
      'The design of physical spaces reflects the values and cultural practices of the people who use them.',
      'Community design is most powerful when it centers the voices of the people it serves.',
      'Math, art, and cultural knowledge all contribute to creating meaningful spaces.'
    ],
    'Community members drive the design through real listening sessions and surveys. Students present to real stakeholders. Some student-designed projects have been built.',
    '{"description": "A scale model and written design proposal for a community gathering space — presented to real community stakeholders.", "format_options": ["Physical model + proposal + presentation", "Digital 3D model + proposal + video walkthrough"], "audience": "School board, city council, parks department, neighborhood association, and families", "presentation_format": "Formal design proposal presentation to community stakeholders with scale models", "quality_criteria": ["Design responds to community-identified needs", "Cultural gathering practices reflected in design", "Model built to scale with accurate math", "Proposal is professional and persuasive"]}'::jsonb,
    4,
    '[
      {"id": "space-p1", "title": "Explore & Listen", "description": "Walk the community observing gathering spaces. Listen to what community members need.", "duration_days": 4, "dok_level": 2, "activities": [{"id": "space-a1", "title": "Gathering Space Walk", "description": "Walk the neighborhood identifying where people gather: parks, stoops, parking lots, community centers.", "activity_type": "field_work", "is_required": true, "estimated_minutes": 75, "resources": ["Walking route map", "Camera", "Gathering space survey form"], "educator_notes": "Look beyond formal spaces. Where do people ACTUALLY gather?"},{"id": "space-a2", "title": "Community Listening Session", "description": "Host a listening session where community members discuss what spaces are needed.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 60, "resources": ["Facilitation guide", "Note-taking templates", "Refreshments"], "educator_notes": "This must be genuine listening. Provide translation support."},{"id": "space-a3", "title": "Cultural Gathering Research", "description": "Students research how their own cultures gather. What are traditional gathering spaces like?", "activity_type": "investigation", "is_required": true, "estimated_minutes": 45, "resources": ["Cultural gathering research guide"], "educator_notes": "Every culture has spatial wisdom about how people come together."}], "reflection_prompts": ["What gathering space in your life feels most welcoming? Why?", "How does your culture''s way of gathering influence what you would design?"], "checkpoint": null},
      {"id": "space-p2", "title": "Measure & Analyze", "description": "Apply math and spatial reasoning. Conduct needs assessments and site analysis.", "duration_days": 6, "dok_level": 3, "activities": [{"id": "space-a4", "title": "Site Analysis & Measurement", "description": "Select a site. Measure dimensions, map to scale, note sun exposure and access points.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 90, "resources": ["Measuring tapes", "Graph paper", "Compasses"], "educator_notes": "Real math: area, perimeter, scale, proportion."},{"id": "space-a5", "title": "Needs Assessment Survey", "description": "Design and conduct a community survey. Analyze data with graphs and percentages.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 90, "resources": ["Survey design template", "Data analysis worksheets"], "educator_notes": "Surveys should be in community languages."},{"id": "space-a6", "title": "Precedent Study", "description": "Research inspiring community spaces that honor cultural diversity.", "activity_type": "investigation", "is_required": true, "estimated_minutes": 60, "resources": ["Precedent study examples"], "educator_notes": "Find examples where culture influenced design."},{"id": "space-a7", "title": "Budget & Materials Math", "description": "Research costs. Create a realistic budget.", "activity_type": "skill_building", "is_required": true, "estimated_minutes": 60, "resources": ["Material cost sheets", "Budget template"], "educator_notes": "Real-world math: cost per square foot, budgeting with constraints."}], "reflection_prompts": ["What did the survey data reveal about community values?", "What cultural design elements inspired you most?"], "checkpoint": {"title": "Needs Assessment & Site Analysis", "description": "Educator reviews survey data, site measurements, and research.", "assessment_type": "educator_check", "competency_ids": [], "criteria": ["Site measured and drawn to scale", "Survey conducted and analyzed", "At least 2 precedent studies reviewed", "Budget framework established"]}},
      {"id": "space-p3", "title": "Design & Model", "description": "Design the space integrating community input, cultural knowledge, and math. Build models.", "duration_days": 7, "dok_level": 4, "activities": [{"id": "space-a8", "title": "Design Charrette", "description": "Collaborative design session: develop concepts responding to community needs and cultural practices.", "activity_type": "creation", "is_required": true, "estimated_minutes": 90, "resources": ["Large paper", "Markers", "Site maps"], "educator_notes": "Every design must include at least one culturally-inspired element."},{"id": "space-a9", "title": "Scale Model Construction", "description": "Build a physical scale model using cardboard and craft materials or digital 3D tools.", "activity_type": "creation", "is_required": true, "estimated_minutes": 180, "resources": ["Cardboard", "Craft supplies", "Hot glue guns", "Scale rulers"], "educator_notes": "Include signage in community languages."},{"id": "space-a10", "title": "Design Review with Community Panel", "description": "Present designs to community members and local professionals. Revise based on feedback.", "activity_type": "collaboration", "is_required": true, "estimated_minutes": 60, "resources": ["Presentation setup", "Feedback forms"], "educator_notes": "Invite someone from parks & rec or a local architect."}], "reflection_prompts": ["How does your design honor the cultural diversity of the community?", "What trade-offs did you make?"], "checkpoint": {"title": "Community Design Panel", "description": "Community members and professionals review models.", "assessment_type": "group_critique", "competency_ids": [], "criteria": ["Design responds to community needs", "Cultural practices reflected", "Model built to scale", "Community feedback incorporated"]}},
      {"id": "space-p4", "title": "Present & Propose", "description": "Present final designs to community stakeholders in a formal proposal.", "duration_days": 3, "dok_level": 4, "activities": [{"id": "space-a11", "title": "Proposal Writing", "description": "Write a formal design proposal: problem statement, needs, design, budget, cultural significance.", "activity_type": "creation", "is_required": true, "estimated_minutes": 90, "resources": ["Proposal template", "Model photos", "Budget summary"], "educator_notes": "Include a section on cultural significance."},{"id": "space-a12", "title": "Community Presentation", "description": "Present to school board, city council, parks dept, or neighborhood association.", "activity_type": "presentation", "is_required": true, "estimated_minutes": 90, "resources": ["Scale models", "Printed proposals"], "educator_notes": "Invite real decision-makers."},{"id": "space-a13", "title": "Reflection & Next Steps", "description": "What would it take to make this real? How can we continue advocating?", "activity_type": "reflection", "is_required": true, "estimated_minutes": 30, "resources": ["Reflection journal"], "educator_notes": "Connect students to ongoing community planning processes."}], "reflection_prompts": ["What did you learn about design as a tool for community change?", "How did math help you make better design decisions?"], "checkpoint": {"title": "Proposal Self-Assessment", "description": "Assessment of design thinking, math, and community engagement.", "assessment_type": "self_assessment", "competency_ids": [], "criteria": ["Proposal is professional", "Design integrates math, culture, and community input", "Student can articulate how design serves community"]}}
    ]'::jsonb,
    '[
      {"phase_id": "space-p1", "description": "Choose which type of community space to investigate.", "choice_type": "topic_selection", "options": ["Outdoor gathering/park", "Community garden", "Youth and family center", "Outdoor classroom", "Multicultural marketplace"]},
      {"phase_id": "space-p3", "description": "Choose how to build the model.", "choice_type": "product_format", "options": ["Physical cardboard model", "Digital 3D model (Tinkercad)", "Detailed drawings + model", "Mixed media model"]},
      {"phase_id": "space-p4", "description": "Choose presentation approach.", "choice_type": "presentation_style", "options": ["Formal proposal to panel", "Design exhibition", "Video proposal", "Community design fair"]}
    ]'::jsonb,
    'Community Design Review Panel: community members and a local design professional review designs for responsiveness, cultural authenticity, and feasibility.',
    'Start with the gathering space walk. The community listening session must happen early. Front-load scale drawing and measurement skills. The community panel critique is essential.',
    '{"extending": "Research universal design principles. Develop a phased implementation plan. Create a sustainability plan.", "supporting": "Provide pre-measured site maps. Offer model building kits. Use visual survey tools. Allow team roles matching strengths.", "ell_accommodations": "Conduct surveys in families'' languages. Allow design presentations with visual models as primary communication. Provide bilingual math vocabulary.", "accessibility_notes": "Ensure site walks are accessible. Provide digital design alternatives. Incorporate universal design as a project requirement."}'::jsonb,
    '[
      {"title": "Tinkercad", "type": "tool", "url": "https://www.tinkercad.com", "notes": "Free browser-based 3D design tool."},
      {"title": "Community Listening Session Guide", "type": "printable", "url": null, "notes": "Facilitation guide for inclusive community input."},
      {"title": "Scale Drawing Template", "type": "printable", "url": null, "notes": "Graph paper with scale conversion chart."},
      {"title": "Design Proposal Template", "type": "printable", "url": null, "notes": "Community need, design concept, cultural significance, budget, maintenance."}
    ]'::jsonb,
    ARRAY['place-based', 'culturally-immersive', 'math', 'design', 'community-planning', 'architecture', 'middle-school'],
    1,
    'published'
  );

  RAISE NOTICE 'Inserted 5 place-based culturally immersive PBL templates for school %', v_school_id;
END $$;
