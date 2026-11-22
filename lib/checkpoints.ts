export type CheckpointQuestion = {
  prompt: string;
  choices: readonly string[];
  correct: number;
  feedback: readonly string[];
};

export type Checkpoint = {
  concept: string;
  practice: string;
  questions: readonly CheckpointQuestion[];
};

export type CheckpointRef = {
  journeyId: string;
  moduleId: string;
};

export type CheckpointAttempt = CheckpointRef & {
  id: string;
  question: number;
  choice: number;
  reasoning: string;
  correct: boolean;
  date: string;
};

const pythonChecks: Readonly<Record<string, Checkpoint>> = {
  "python-s0-m0": {
    concept: "Text and numeric values",
    practice:
      "Compare `type('15')` with `type(15)`. Convert the text using `int()` before adding, then explain why converting after addition would be too late.",
    questions: [
      {
        prompt:
          "A form gives you `minutes = '15'`. What should you run to calculate 20 minutes?",
        choices: ["minutes + 5", "int(minutes) + 5", "minutes + '5'"],
        correct: 1,
        feedback: [
          "Python cannot add a string and an integer directly.",
          "Convert the string to an integer first, then add 5.",
          "Adding two strings joins their text, giving '155'.",
        ],
      },
      {
        prompt:
          "A CSV reader returns `['12', '8']`. What produces the total 20?",
        choices: [
          "sum(int(value) for value in values)",
          "values[0] + values[1]",
          "int(values[0] + values[1])",
        ],
        correct: 0,
        feedback: [
          "Convert each field to an integer before summing.",
          "This joins the text into '128'.",
          "The text is already joined before conversion, so this produces 128.",
        ],
      },
      {
        prompt:
          "You want `'4'` sessions of 6 minutes to give 24. Which expression works?",
        choices: ["'4' * 6", "str(4) + str(6)", "int('4') * 6"],
        correct: 2,
        feedback: [
          "Multiplying a string repeats the text.",
          "Adding these strings joins the digits.",
          "Converting the session count gives numeric multiplication.",
        ],
      },
    ],
  },
  "python-s0-m1": {
    concept: "Iterating over records",
    practice:
      "Write two dictionaries with a `minutes` field and put them in a list. In `for session in sessions`, print `session` once, then print `session['minutes']`. Explain what changes on each iteration.",
    questions: [
      {
        prompt:
          "`sessions` is a list of dictionaries. Inside `for session in sessions:`, how do you read the current session's minutes?",
        choices: ["sessions['minutes']", "session[0]", "session['minutes']"],
        correct: 2,
        feedback: [
          "The outer list uses integer positions. Read the named field from the current dictionary instead.",
          "The current record is a dictionary with a 'minutes' key.",
          "Each iteration gives you one dictionary. Access its 'minutes' field by key.",
        ],
      },
      {
        prompt:
          "Each entry in `books` has a `pages` field. How do you add the pages from every book?",
        choices: [
          "Loop over books and add book['pages'] to a running total",
          "Read books['pages'] once",
          "Add len(books) to the total once per book",
        ],
        correct: 0,
        feedback: [
          "The variable book is the current record. Its pages can be added to a running total.",
          "books is the list, so it doesn't have a 'pages' field.",
          "len(books) counts records. It doesn't read page counts.",
        ],
      },
      {
        prompt:
          "In `for day in week:`, what does `day` represent if `week` is a list of dictionaries?",
        choices: [
          "The integer index of the current record",
          "One dictionary from the list",
          "All dictionaries in the list",
        ],
        correct: 1,
        feedback: [
          "A for loop over a list yields its items. Use enumerate if you need an index too.",
          "The loop assigns the current item to day, so day is one dictionary.",
          "week is the entire list. day is a single item from it.",
        ],
      },
    ],
  },
};

export function findCheckpoint(divisionId: string, moduleId: string) {
  return divisionId === "starter-python" &&
    Object.hasOwn(pythonChecks, moduleId)
    ? pythonChecks[moduleId]
    : undefined;
}

export function nextCheckpointQuestion(
  check: Checkpoint,
  attempts: CheckpointAttempt[],
) {
  if (attempts.some((attempt) => attempt.correct)) return undefined;
  return check.questions[attempts.length];
}
