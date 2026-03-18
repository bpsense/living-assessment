-- 031_seed_default_framework.sql
-- Seeds a default Common Core-aligned competency framework for new schools.
-- Also creates a trigger so every newly created school auto-gets this framework.

-- ============================================================
-- Function: seed_default_competency_framework(school_id)
-- ============================================================

create or replace function seed_default_competency_framework(p_school_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_fw_id uuid;
  v_dom_id uuid;
  v_sd_id uuid;
begin
  -- Check if school already has a default framework
  select id into v_fw_id
    from competency_frameworks
    where school_id = p_school_id and is_default = true
    limit 1;

  if v_fw_id is not null then
    return v_fw_id;
  end if;

  -- 1. Create framework
  insert into competency_frameworks (school_id, name, description, version, is_default)
  values (
    p_school_id,
    'Common Core Standards',
    'Default competency framework aligned with Common Core State Standards',
    '1.0',
    true
  )
  returning id into v_fw_id;

  -- ============================================================
  -- Domain 1: English Language Arts
  -- ============================================================
  insert into competency_domains (framework_id, name, display_order, code_prefix)
  values (v_fw_id, 'English Language Arts', 0, 'ELA')
  returning id into v_dom_id;

  -- Subdomain: Reading
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Reading', 0)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'ELA.R.1', 'Key Ideas and Details',
   'Read closely to determine what the text says explicitly and make logical inferences',
   '{"E4":"Identifies characters and settings","E5":"Retells familiar stories","E6":"Asks and answers questions about key details","1":"Asks and answers questions about key details in a text","2":"Asks and answers questions to demonstrate understanding","3":"Asks and answers questions referring to the text","4":"Refers to details and examples when explaining","5":"Quotes accurately from a text","6":"Cites textual evidence to support analysis","7":"Cites several pieces of textual evidence","8":"Cites the strongest textual evidence","9":"Cites strong and thorough textual evidence","10":"Cites strong and thorough textual evidence including what is left uncertain"}'::jsonb),
  (v_sd_id, v_fw_id, 'ELA.R.2', 'Craft and Structure',
   'Interpret words and phrases as they are used in a text',
   '{"E4":"Recognizes common types of texts","E5":"Recognizes common words in context","E6":"Identifies front cover, back cover, and title page","1":"Identifies words and phrases that suggest feelings","2":"Describes how words and phrases supply rhythm and meaning","3":"Determines the meaning of words and phrases","4":"Determines meaning of general academic vocabulary","5":"Determines meaning of figurative language","6":"Determines meaning of words and phrases including figurative language","7":"Determines meaning of words and phrases including technical meanings","8":"Determines meaning of words and phrases including analogies","9":"Determines meaning of words and phrases including figurative and connotative meanings","10":"Determines meaning of words and phrases at all complexity levels"}'::jsonb),
  (v_sd_id, v_fw_id, 'ELA.R.3', 'Integration of Knowledge',
   'Integrate and evaluate content presented in diverse media and formats',
   '{"E4":"Describes illustrations in stories","E5":"Recognizes types of texts","E6":"Describes relationship between illustrations and text","1":"Uses illustrations and details to describe characters and setting","2":"Uses information from illustrations to understand text","3":"Explains how illustrations contribute to the text","4":"Makes connections between text and visual presentation","5":"Draws on information from multiple sources","6":"Compares texts in different forms or genres","7":"Compares a written text to audio or multimedia version","8":"Evaluates advantages and disadvantages of media","9":"Analyzes various accounts of a subject in different mediums","10":"Analyzes multiple interpretations in different mediums"}'::jsonb);

  -- Subdomain: Writing
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Writing', 1)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'ELA.W.1', 'Text Types and Purposes',
   'Write arguments, informative texts, and narratives',
   '{"E4":"Draws and dictates to express ideas","E5":"Uses drawings and writing to compose texts","E6":"Uses combination of drawing, dictating, and writing","1":"Writes opinion pieces with reasons","2":"Writes opinion pieces with supporting reasons","3":"Writes opinion pieces with organizational structure","4":"Writes opinion pieces supporting with reasons and information","5":"Writes opinion pieces supporting with facts and details","6":"Writes arguments to support claims with clear reasons","7":"Writes arguments to support claims with relevant evidence","8":"Writes arguments to support claims with valid reasoning","9":"Writes arguments to support claims in analysis of topics","10":"Writes arguments to support claims in analysis of substantive topics"}'::jsonb),
  (v_sd_id, v_fw_id, 'ELA.W.2', 'Production and Distribution',
   'Produce clear and coherent writing appropriate to task',
   '{"E4":"Explores writing tools and materials","E5":"Responds to questions and suggestions about writing","E6":"Responds to questions and suggestions from peers","1":"With guidance, focuses on a topic and strengthens writing","2":"With guidance, focuses on a topic and strengthens writing through revision","3":"With guidance, develops and strengthens writing through planning and revising","4":"With guidance, produces writing with development and organization","5":"With guidance, produces clear and coherent writing","6":"Produces clear and coherent writing appropriate to task","7":"Produces clear and coherent writing appropriate to task, purpose, and audience","8":"Produces clear and coherent writing with appropriate development","9":"Produces clear, coherent writing with appropriate style","10":"Produces clear, coherent writing with purposeful style choices"}'::jsonb);

  -- ============================================================
  -- Domain 2: Mathematics
  -- ============================================================
  insert into competency_domains (framework_id, name, display_order, code_prefix)
  values (v_fw_id, 'Mathematics', 1, 'MATH')
  returning id into v_dom_id;

  -- Subdomain: Number and Operations
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Number and Operations', 0)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'MATH.N.1', 'Counting and Cardinality',
   'Know number names and the count sequence',
   '{"E4":"Counts to 10 by ones","E5":"Counts to 20 by ones","E6":"Counts to 100 by ones and tens","1":"Extends counting sequence to 120","2":"Counts within 1000 and skip-counts","3":"Uses place value understanding to round numbers","4":"Generalizes place value understanding for multi-digit numbers","5":"Understands place value system","6":"Fluently computes multi-digit numbers","7":"Applies understanding of operations to compute with rational numbers","8":"Knows that there are numbers that are not rational","9":"Reasons quantitatively about real number expressions","10":"Extends properties of exponents to rational exponents"}'::jsonb),
  (v_sd_id, v_fw_id, 'MATH.N.2', 'Operations and Algebraic Thinking',
   'Represent and solve problems involving arithmetic operations',
   '{"E4":"Understands addition as putting together","E5":"Represents addition and subtraction with objects","E6":"Represents and solves addition and subtraction word problems","1":"Uses addition and subtraction within 20 to solve problems","2":"Uses addition and subtraction within 100 to solve problems","3":"Uses multiplication and division within 100","4":"Uses four operations to solve multi-step word problems","5":"Writes and interprets numerical expressions","6":"Applies properties of operations to generate equivalent expressions","7":"Uses properties of operations to generate equivalent expressions","8":"Works with radicals and integer exponents","9":"Uses algebra to solve equations and inequalities","10":"Creates equations and inequalities to solve problems"}'::jsonb);

  -- Subdomain: Geometry
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Geometry', 1)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'MATH.G.1', 'Shapes and Spatial Reasoning',
   'Identify and describe shapes and spatial relationships',
   '{"E4":"Recognizes basic shapes","E5":"Describes shapes in the environment","E6":"Correctly names shapes and describes their positions","1":"Distinguishes between defining and non-defining attributes of shapes","2":"Recognizes and draws shapes with specified attributes","3":"Understands concepts of area and perimeter","4":"Draws and identifies lines and angles","5":"Graphs points on coordinate plane","6":"Solves real-world problems involving area and volume","7":"Draws, constructs, and describes geometrical figures","8":"Understands congruence and similarity","9":"Uses coordinates to prove geometric theorems","10":"Applies geometric concepts in modeling situations"}'::jsonb);

  -- ============================================================
  -- Domain 3: Science
  -- ============================================================
  insert into competency_domains (framework_id, name, display_order, code_prefix)
  values (v_fw_id, 'Science', 2, 'SCI')
  returning id into v_dom_id;

  -- Subdomain: Physical Science
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Physical Science', 0)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'SCI.P.1', 'Matter and Its Interactions',
   'Develop understanding of matter, its properties, and interactions',
   '{"E4":"Explores properties of objects","E5":"Sorts objects by observable properties","E6":"Plans and conducts investigations about different materials","1":"Plans and conducts investigations on effects of sunlight","2":"Plans and conducts investigations of heating and cooling","3":"Plans investigations to determine cause and effect of electric interactions","4":"Develops models to describe that matter is made of particles","5":"Develops models describing that matter is made of atoms","6":"Develops models to describe atomic composition of molecules","7":"Analyzes and interprets data on properties of substances","8":"Develops models to describe atomic composition","9":"Uses the periodic table as a model to predict properties","10":"Uses mathematical representations to support claims about atomic interactions"}'::jsonb),
  (v_sd_id, v_fw_id, 'SCI.P.2', 'Energy',
   'Understand concepts of energy and energy transfer',
   '{"E4":"Explores cause and effect with motion","E5":"Plans investigations about what makes things move","E6":"Makes observations to determine the effect of sunlight on surfaces","1":"Applies understanding of how light travels","2":"Makes observations to construct evidence-based account of sound","3":"Asks questions about cause and effect of electric or magnetic interactions","4":"Applies understanding of energy and energy transfer","5":"Develops understanding of energy and its conservation","6":"Constructs and interprets models of energy transfer","7":"Constructs, uses, and presents arguments for energy transfer","8":"Plans investigations to determine relationship between energy and temperature","9":"Develops models to illustrate energy at macroscopic scale","10":"Uses mathematical representations of energy relationships"}'::jsonb);

  -- Subdomain: Life Science
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Life Science', 1)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'SCI.L.1', 'Ecosystems and Organisms',
   'Develop understanding of ecosystems and organism interactions',
   '{"E4":"Observes living things in the environment","E5":"Communicates solutions about what plants and animals need","E6":"Uses observations to describe patterns of what plants and animals need","1":"Uses materials to design a solution that reduces impact on land","2":"Develops models describing how animals depend on their surroundings","3":"Constructs an argument that some animals form groups to survive","4":"Develops models to describe movement of matter among living things","5":"Develops models describing movement of matter and energy in ecosystems","6":"Constructs scientific explanations of organism interactions","7":"Analyzes and interprets data for patterns in ecosystem interactions","8":"Analyzes data to provide evidence for effects of resource availability","9":"Uses mathematical models to support explanations of ecosystem dynamics","10":"Evaluates claims, evidence, and reasoning about complex ecosystem interactions"}'::jsonb);

  -- ============================================================
  -- Domain 4: Social-Emotional Learning
  -- ============================================================
  insert into competency_domains (framework_id, name, display_order, code_prefix)
  values (v_fw_id, 'Social-Emotional Learning', 3, 'SEL')
  returning id into v_dom_id;

  -- Subdomain: Self-Awareness
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Self-Awareness', 0)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'SEL.SA.1', 'Emotional Awareness',
   'Recognize and label own emotions accurately',
   '{"E4":"Identifies basic emotions with adult support","E5":"Names own emotions when prompted","E6":"Identifies and labels a range of emotions in self","1":"Recognizes how different situations trigger different emotions","2":"Describes how emotions affect behavior and interactions","3":"Identifies patterns in emotional responses across situations","4":"Analyzes how thoughts influence emotions and behavior","5":"Evaluates how personal strengths and challenges affect emotions","6":"Examines how identity and culture influence emotional expression","7":"Analyzes the connection between values, emotions, and behavior","8":"Evaluates how biases and stereotypes affect emotional responses","9":"Integrates self-awareness into personal growth planning","10":"Demonstrates sophisticated emotional vocabulary and self-reflection"}'::jsonb);

  -- Subdomain: Relationship Skills
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Relationship Skills', 1)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'SEL.RS.1', 'Communication and Collaboration',
   'Use positive communication and teamwork skills',
   '{"E4":"Takes turns with adult support","E5":"Plays cooperatively with peers","E6":"Demonstrates cooperative play and sharing","1":"Works with a partner using agreed-upon rules","2":"Listens actively and takes turns speaking in groups","3":"Communicates ideas clearly and listens respectfully","4":"Demonstrates active listening and constructive feedback","5":"Works effectively in diverse teams with shared goals","6":"Resolves interpersonal conflicts constructively","7":"Advocates for the needs of self and others","8":"Builds and maintains healthy relationships across differences","9":"Mentors and supports peers in collaborative settings","10":"Demonstrates leadership in diverse collaborative environments"}'::jsonb),
  (v_sd_id, v_fw_id, 'SEL.RS.2', 'Conflict Resolution',
   'Navigate disagreements and find constructive solutions',
   '{"E4":"Seeks adult help when frustrated","E5":"Uses words instead of actions to express needs","E6":"Identifies simple conflict resolution strategies","1":"Describes how own actions affect others","2":"Identifies multiple solutions to social problems","3":"Uses negotiation skills to resolve conflicts","4":"Considers others perspectives during disagreements","5":"Mediates minor conflicts between peers","6":"Applies restorative practices in conflict situations","7":"Analyzes root causes of conflict in relationships","8":"Facilitates resolution in group conflicts","9":"Advocates for justice and equity in social situations","10":"Models and teaches conflict resolution strategies to others"}'::jsonb);

  -- ============================================================
  -- Domain 5: 21st Century Skills
  -- ============================================================
  insert into competency_domains (framework_id, name, display_order, code_prefix)
  values (v_fw_id, '21st Century Skills', 4, 'C21')
  returning id into v_dom_id;

  -- Subdomain: Critical Thinking
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Critical Thinking', 0)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'C21.CT.1', 'Analysis and Reasoning',
   'Analyze information and construct logical arguments',
   '{"E4":"Explores cause and effect with adult support","E5":"Asks why questions about the world","E6":"Compares and contrasts objects and ideas","1":"Asks and answers questions about what is read or heard","2":"Identifies main topic and retells key details","3":"Distinguishes own point of view from that of the author","4":"Explains events and concepts based on information in a text","5":"Draws inferences from multiple sources of information","6":"Evaluates arguments and claims in a text","7":"Assesses quality of reasoning in arguments","8":"Evaluates the validity of arguments using evidence","9":"Synthesizes information from multiple sources to solve problems","10":"Constructs and evaluates complex arguments across disciplines"}'::jsonb);

  -- Subdomain: Digital Literacy
  insert into competency_subdomains (domain_id, name, display_order)
  values (v_dom_id, 'Digital Literacy', 1)
  returning id into v_sd_id;

  insert into competencies (subdomain_id, framework_id, code, name, objective, step_descriptors) values
  (v_sd_id, v_fw_id, 'C21.DL.1', 'Technology Use and Digital Citizenship',
   'Use technology responsibly and effectively',
   '{"E4":"Explores age-appropriate technology with adult support","E5":"Uses basic technology tools with guidance","E6":"Uses technology to create and present ideas","1":"Uses technology to gather and share information","2":"Creates digital products with guidance","3":"Practices safe and responsible technology use","4":"Uses technology to research and organize information","5":"Evaluates digital sources for reliability","6":"Creates multimedia presentations to communicate ideas","7":"Uses technology to collaborate across distances","8":"Analyzes the impact of technology on society","9":"Uses advanced digital tools for research and creation","10":"Designs innovative solutions using digital technology"}'::jsonb);

  return v_fw_id;
end;
$$;

-- ============================================================
-- Trigger: auto-seed framework on new school creation
-- ============================================================

create or replace function trigger_seed_default_framework()
returns trigger
language plpgsql
security definer
as $$
begin
  perform seed_default_competency_framework(new.id);
  return new;
end;
$$;

create trigger seed_framework_on_school_create
  after insert on schools
  for each row
  execute function trigger_seed_default_framework();

-- ============================================================
-- Seed existing schools that don't have a default framework
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select s.id from schools s
    where not exists (
      select 1 from competency_frameworks cf
      where cf.school_id = s.id and cf.is_default = true
    )
  loop
    perform seed_default_competency_framework(r.id);
  end loop;
end;
$$;
