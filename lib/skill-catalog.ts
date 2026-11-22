import type { Division, Curriculum } from "./skill-paths";
type Topic = [string, string, string, string];
type Seed = [string, string, string, string, [string, Topic[]][]];
const seeds: Seed[] = [
  [
    "web",
    "Frontend foundations",
    "Development",
    "Build a responsive, accessible website with HTML, CSS, and JavaScript.",
    [
      [
        "Structure a web page",
        [
          [
            "HTML that has meaning",
            "HTML describes meaning, not appearance. Use headings in order, a main landmark for primary content, and links for navigation.",
            "Create a personal introduction using a header, main, two sections, and a footer.",
            "Your page has one h1, ordered headings, and descriptive link text.",
          ],
          [
            "Forms and useful input",
            "A label gives a control its name. Input types and required attributes provide basic validation; a placeholder does not replace a label.",
            "Add a contact form with labeled name, email, and message fields. Test an invalid email.",
            "Every input has a label and invalid input is rejected before submission.",
          ],
          [
            "Accessible navigation",
            "Keyboard users move with Tab and activate links with Enter. A visible focus indicator shows where they are; meaningful document order makes navigation predictable.",
            "Navigate your entire page without a mouse. Add a skip link to main content.",
            "You can reach every interactive control and see its focus state.",
          ],
        ],
      ],
      [
        "Design for every screen",
        [
          [
            "CSS rules and spacing",
            "The cascade resolves competing declarations. The box model adds padding, border, and margin around content; border-box makes sizing easier to predict.",
            "Create a small spacing scale and style your page using classes rather than inline styles.",
            "Explain which rule wins for a heading and show consistent gaps between sections.",
          ],
          [
            "Flexible layouts",
            "Flexbox arranges items along one axis; grid coordinates rows and columns. Let content determine useful sizes rather than fixing every width.",
            "Build a three-card skill gallery that becomes one column on a narrow screen.",
            "No content overflows horizontally at 360px or 1280px.",
          ],
          [
            "Readable interfaces",
            "Readable line lengths, clear hierarchy, and adequate contrast reduce effort. Do not communicate status with color alone.",
            "Give your gallery clear headings, readable body text, and a text status beside each color indicator.",
            "Zoom to 200% and confirm content and controls remain usable.",
          ],
        ],
      ],
      [
        "Make the page interactive",
        [
          [
            "State and events",
            "An event reports an interaction. Keep your data separate from rendered text, then update the interface from that data when an event occurs.",
            "Add a button that marks a skill card as saved and toggles its label.",
            "Repeated clicks consistently switch both the saved state and button label.",
          ],
          [
            "Filter a collection",
            "Filtering produces a new collection containing matches. Normalize search input for case and whitespace, and show an explicit empty state.",
            "Add a search input that filters your skill gallery by title.",
            "Search ignores letter case, clearing restores cards, and no matches shows helpful text.",
          ],
          [
            "Ship a complete page",
            "A small product still needs loading, error, empty, and success states. Test the user journey rather than only the appearance.",
            "Combine the gallery, search, and contact form. Write a checklist for keyboard, phone, and empty-state behavior.",
            "Complete the checklist and describe one issue you found and fixed.",
          ],
        ],
      ],
    ],
  ],
  [
    "python",
    "Python for practical data",
    "Data & programming",
    "Learn Python by cleaning, summarizing, and explaining a small dataset.",
    [
      [
        "Write useful Python",
        [
          [
            "Values and variables",
            "Variables name values. Strings, numbers, and booleans support different operations; choose names that explain the data rather than its type.",
            "Store a learning goal, daily minutes, and number of days. Calculate a weekly time budget.",
            "The result is correct and you can explain why text and numbers cannot always be added.",
          ],
          [
            "Collections and iteration",
            "Lists preserve a sequence; dictionaries associate keys with values. A loop lets the same logic process every entry without duplicating code.",
            "Create five study-session dictionaries and print a summary for each.",
            "Your code processes all five sessions using one loop.",
          ],
          [
            "Functions and conditions",
            "A function groups one task behind a clear input and output. Conditions handle different cases, including missing or invalid values.",
            "Write a function that totals valid session minutes and ignores negative entries.",
            "Check empty, valid, and invalid inputs and explain each result.",
          ],
        ],
      ],
      [
        "Work with real records",
        [
          [
            "Read a CSV",
            "CSV files store tabular records as text. Use a CSV parser so quoted commas are handled; validate headers before relying on them.",
            "Make a CSV of dates, skills, and minutes. Read it with Python's csv module.",
            "Your program handles a quoted value containing a comma correctly.",
          ],
          [
            "Clean before calculating",
            "Missing values and inconsistent formats can distort a summary. Keep original records and document each cleaning rule.",
            "Add missing minutes and mixed-case skill names. Normalize names and report rejected rows.",
            "You can account for every row and explain why each rejected row was excluded.",
          ],
          [
            "Group and summarize",
            "A total and an average answer different questions. Grouping lets you compare like records; always report how many observations support a result.",
            "Calculate total minutes and session count by skill.",
            "The grouped totals add up to the overall total and include counts.",
          ],
        ],
      ],
      [
        "Explain your findings",
        [
          [
            "Make a clear chart",
            "Choose a chart for the comparison: bars compare categories, while lines show ordered change. Labels and units matter more than decoration.",
            "Plot total study minutes by skill using your preferred plotting tool, or a text bar chart.",
            "The chart has a title, category labels, and minute units.",
          ],
          [
            "Check the conclusion",
            "A pattern does not establish its cause. Small samples and missing data limit what you can claim.",
            "Write two observations and one limitation about your study dataset.",
            "Each observation cites a number and avoids unsupported causal claims.",
          ],
          [
            "Create a repeatable report",
            "A useful analysis can be rerun. Separate reading, cleaning, and reporting, and make failures understandable.",
            "Combine your functions into one script and run it on a second CSV.",
            "The script reports new results without code edits and explains invalid files clearly.",
          ],
        ],
      ],
    ],
  ],
  [
    "design",
    "UI design essentials",
    "Design",
    "Turn a learner's needs into a clear interface and a testable prototype.",
    [
      [
        "Understand the task",
        [
          [
            "Define the user problem",
            "A user problem describes someone trying to do something in a context. A feature request is only one possible response to that problem.",
            "Describe a learner, a task they struggle with, and a measurable successful outcome.",
            "Your statement identifies a task and outcome without prescribing a screen.",
          ],
          [
            "Map the journey",
            "A journey records actions and decisions, including failures. Remove steps that do not help the user reach their goal.",
            "Map the steps from discovering a skill to starting its first module.",
            "Your flow includes a return route and a way to recover from an error.",
          ],
          [
            "Sketch alternatives",
            "Low-detail sketches let you compare structure before investing in polish. Different layouts should test different priorities.",
            "Sketch three ways to show a skill's curriculum and enrollment action.",
            "Explain the tradeoff of each sketch and choose one for a specific reason.",
          ],
        ],
      ],
      [
        "Build a visual system",
        [
          [
            "Hierarchy and typography",
            "Size, weight, position, and spacing establish reading order. Use a small type scale and keep body text easy to scan.",
            "Design a skill detail screen with a clear title, summary, and next action.",
            "A reviewer can identify the next action without reading every paragraph.",
          ],
          [
            "Spacing and components",
            "Reusable components make similar actions behave consistently. Define states as well as the default appearance.",
            "Create button, input, and curriculum-row components with hover, focus, disabled, and error states.",
            "The same interaction has the same appearance across two screens.",
          ],
          [
            "Accessible color",
            "Contrast supports readability; labels and icons communicate meaning independently of color. Focus and error states need explicit design.",
            "Create light and dark versions of the skill screen and label progress in text.",
            "Check text contrast and show how the interface works without relying on color.",
          ],
        ],
      ],
      [
        "Prototype and improve",
        [
          [
            "Connect the flow",
            "A prototype tests a sequence of actions. Include realistic content and an obvious way to undo or return.",
            "Connect discovery, enrollment, and a first-module screen in a design tool of your choice.",
            "Someone can finish the flow without your explanation.",
          ],
          [
            "Run a usability session",
            "Ask a participant to complete a task, not to find a particular button. Observe behavior before offering help.",
            "Ask a consenting peer to enroll in a skill using your prototype. Record three observations without private details.",
            "Your notes distinguish observed behavior from your interpretation.",
          ],
          [
            "Document an iteration",
            "An improvement should respond to evidence. A short rationale makes a design decision understandable to others.",
            "Revise the biggest source of confusion and document a before-and-after comparison.",
            "Explain the observation, the change, and how you would test it again.",
          ],
        ],
      ],
    ],
  ],
  [
    "speaking",
    "Clear communication",
    "Communication",
    "Plan, practice, and improve a concise presentation around a useful message.",
    [
      [
        "Shape a clear message",
        [
          [
            "Know your audience",
            "A useful explanation starts with what the listener already knows and what they need to do next.",
            "Choose a topic and describe the audience's knowledge, question, and desired next action.",
            "Your message answers one specific audience question.",
          ],
          [
            "Build a simple structure",
            "An opening establishes relevance, the middle supports the message, and the ending gives a takeaway. One short talk needs one main point.",
            "Outline a two-minute explanation with an opening, two supporting ideas, and a takeaway.",
            "Every supporting idea connects to the same main point.",
          ],
          [
            "Use concrete examples",
            "A concrete example connects an unfamiliar idea to an observable situation. Name the limits of an analogy so it does not mislead.",
            "Write a short example that explains one technical or creative concept to a beginner.",
            "A beginner can restate the idea and name where the analogy stops working.",
          ],
        ],
      ],
      [
        "Practice deliberately",
        [
          [
            "Pace and pauses",
            "A pause gives listeners time to process an idea. Short sentences and deliberate transitions can improve clarity without making speech unnatural.",
            "Read your outline aloud and mark three places to pause. Time two attempts.",
            "The explanation fits two minutes without dropping the takeaway.",
          ],
          [
            "Support with visuals",
            "A visual should support a specific point. Too much on-screen text competes with the spoken explanation.",
            "Create three simple slides or visual notes with one purpose each.",
            "Remove anything that does not support the point being spoken.",
          ],
          [
            "Review a recording",
            "Review observable behavior rather than judging yourself broadly. Choose one thing to improve on the next attempt.",
            "Record a practice talk for yourself and note one unclear phrase and one useful delivery choice.",
            "Your next recording addresses the specific unclear phrase.",
          ],
        ],
      ],
      [
        "Listen and respond",
        [
          [
            "Ask useful questions",
            "Open questions reveal understanding. A specific follow-up helps clarify a point without assuming agreement.",
            "Write three audience questions and practice a brief response to each.",
            "Each response answers the question before adding background.",
          ],
          [
            "Use feedback carefully",
            "Feedback is most useful when it describes a moment and its effect. You can evaluate a suggestion without accepting every preference.",
            "Request one specific piece of feedback from a consenting peer, or compare your recording with your own checklist.",
            "Name the evidence behind the change you choose to make.",
          ],
          [
            "Deliver and reflect",
            "Preparation improves through a loop of planning, practice, delivery, and reflection. Record the next action while the experience is fresh.",
            "Deliver the two-minute talk and write a short reflection with one strength and one next practice goal.",
            "Your reflection includes a concrete example and an actionable next goal.",
          ],
        ],
      ],
    ],
  ],
  [
    "sql",
    "SQL data foundations",
    "Data & programming",
    "Query, combine, and validate records using a small practice database.",
    [
      [
        "Read a table",
        [
          [
            "Rows, columns, and keys",
            "A row records one entity or event. A primary key identifies it; column types constrain the values that make sense.",
            "Sketch a study_sessions table with an ID, skill, date, and duration. Add six example rows.",
            "Each row has a unique identifier and an explicit unit for duration.",
          ],
          [
            "Select and filter",
            "SELECT chooses columns, WHERE filters rows, and ORDER BY defines result order. Without an ordering clause, returned order is not guaranteed.",
            "Query sessions longer than 20 minutes, sorted by date.",
            "The result excludes shorter sessions and has an explicit ordering clause.",
          ],
          [
            "Nulls and missing values",
            "NULL represents missing or unknown information. Use IS NULL rather than equality; absence is not the same as zero.",
            "Add a missing duration and query which sessions need correction.",
            "Explain why a missing duration should not automatically become zero.",
          ],
        ],
      ],
      [
        "Summarize and combine",
        [
          [
            "Aggregate with care",
            "GROUP BY creates groups for calculations. COUNT(*) counts rows; COUNT(column) excludes null values.",
            "Calculate session counts and total duration by skill.",
            "Show how a null duration affects the count and sum.",
          ],
          [
            "Join related records",
            "A join combines rows using a relationship. A non-unique join key can multiply results, so check the intended relationship first.",
            "Create a skills table and join its names to session records using a skill ID.",
            "The join returns the expected number of sessions without duplicates.",
          ],
          [
            "Keep unmatched rows",
            "An inner join keeps matches; a left join preserves every row from its left input. Filtering the right table in WHERE can discard unmatched rows.",
            "List every skill, including skills with no study sessions.",
            "Your query includes a skill with zero sessions and explains the join choice.",
          ],
        ],
      ],
      [
        "Validate a small report",
        [
          [
            "Check assumptions",
            "A correct-looking query can answer the wrong question. Define the period, units, and inclusion rules before calculating.",
            "Write a specification for a weekly learning report and its edge cases.",
            "The specification handles week boundaries and missing durations.",
          ],
          [
            "Compare totals",
            "Independent reconciliation can expose duplicated or omitted records. Compare grouped totals against a simpler overall query.",
            "Compare your per-skill totals with the overall total and investigate differences.",
            "Both totals reconcile or you can explain the exact difference.",
          ],
          [
            "Deliver a reproducible query",
            "A report is easier to maintain when it names columns clearly and documents assumptions alongside the query.",
            "Save the schema, practice records, and weekly report query together with brief instructions.",
            "Another learner can reproduce the result using only those instructions.",
          ],
        ],
      ],
    ],
  ],
  [
    "research",
    "Research and critical thinking",
    "Study skills",
    "Turn a broad question into an evidence-based explanation with clear limits.",
    [
      [
        "Ask a useful question",
        [
          [
            "Narrow the problem",
            "A focused question defines what you need to know and the context in which the answer matters.",
            "Choose a learning topic and turn it into one question that can be investigated in an hour.",
            "The question has a clear scope and does not assume its own answer.",
          ],
          [
            "Separate claims from evidence",
            "A claim is an assertion; evidence supports it. An example may illustrate a claim without establishing how common it is.",
            "Identify three claims in an article or explanation and note the evidence offered for each.",
            "You distinguish observation, opinion, and unsupported assertion.",
          ],
          [
            "Plan your search",
            "Useful searches combine the central concept with context and source type. Keep a record so another person can retrace your choices.",
            "Write three search queries and the kind of primary source each is intended to find.",
            "Each query addresses a distinct part of your question.",
          ],
        ],
      ],
      [
        "Evaluate what you find",
        [
          [
            "Check the source",
            "Consider who created a source, how they know, when it was produced, and what interests may affect the presentation.",
            "Evaluate two sources using authorship, method, date, and purpose.",
            "Explain why each source is useful for a particular claim, rather than simply calling it reliable.",
          ],
          [
            "Compare independent evidence",
            "Several pages repeating one claim are not several independent sources. Trace important claims back to their original evidence.",
            "Compare two accounts of one claim and identify whether they depend on the same original source.",
            "You can name the original evidence and distinguish repetition from corroboration.",
          ],
          [
            "Look for limitations",
            "Methods, sample selection, and missing information limit conclusions. Acknowledging limits makes an explanation more accurate.",
            "Record one limitation and one plausible alternative explanation for your main finding.",
            "Your alternative does not require inventing facts.",
          ],
        ],
      ],
      [
        "Build a clear explanation",
        [
          [
            "Organize an argument",
            "An argument connects a conclusion to reasons and evidence. State the logical connection rather than expecting a quotation to explain itself.",
            "Draft a conclusion supported by two reasons, each tied to a source.",
            "Every reason supports the conclusion and has identifiable evidence.",
          ],
          [
            "Attribute accurately",
            "Paraphrasing means expressing an idea accurately in your own words and still crediting its source. Keep quotations short and exact.",
            "Paraphrase a useful passage, include its source, and compare it with the original for accuracy.",
            "Your version changes the wording without changing the meaning or losing attribution.",
          ],
          [
            "Explain what remains unknown",
            "A careful answer distinguishes established evidence, reasonable inference, and unanswered questions.",
            "Write a 250-word answer to your question with sources, one limitation, and a next investigation step.",
            "A reader can tell which claims are supported and what still needs evidence.",
          ],
        ],
      ],
    ],
  ],
];
export const starterDivisions: Division[] = seeds.map(
  ([id, title, category, summary, sections]) => ({
    id: `starter-${id}`,
    title,
    category,
    summary,
    level: "beginner",
    visibility: "public",
    source: "starter",
    author: "SkillSwap",
    sections: sections.map(([title, topics], s) => ({
      id: `${id}-s${s}`,
      title,
      modules: topics.map(([title, lesson, exercise, check], m) => ({
        id: `${id}-s${s}-m${m}`,
        title,
        lesson,
        exercise,
        check,
        minutes: 25,
      })),
    })),
  }),
);
export function blankCurriculum(title = "My new skill"): Curriculum {
  return {
    title,
    summary: "A learning path I can adapt to my goals and practice.",
    category: "My skills",
    level: "beginner",
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Foundations",
        modules: [
          {
            id: crypto.randomUUID(),
            title: "My first module",
            lesson:
              "Write a clear explanation of the concept you want to learn.",
            exercise: "Describe a specific exercise you can complete.",
            check: "Describe what you will be able to demonstrate.",
            minutes: 25,
          },
        ],
      },
    ],
  };
}
