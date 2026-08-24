// Assessment tracks for applied candidates.
// Track assignment mirrors the API (workers-api/src/services/assessments.ts).
// The API remains the authority for what gets recorded; this module decides
// which track is shown and how the answers are rendered and scored.

export type AssessmentTrack =
  "office" | "technical" | "analytical" | "creative" | "none";

export interface MCQ {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface Scenario {
  prompt: string;
  placeholder: string;
}

export interface TrackConfig {
  track: Exclude<AssessmentTrack, "none">;
  title: string;
  blurb: string;
  duration: string;
  questions: MCQ[];
  scenario: Scenario;
}

export function trackForDepartment(department: string): AssessmentTrack {
  const dept = (department || "").toLowerCase();
  if (dept.includes("on-site") || dept.includes("manual")) return "none";
  if (
    dept.includes("engineering") ||
    dept.includes("security") ||
    dept.includes("technical support") ||
    dept.includes("ai") ||
    dept.includes("it")
  ) {
    return "technical";
  }
  if (
    dept.includes("data") ||
    dept.includes("finance") ||
    dept.includes("senior") ||
    dept.includes("executive")
  ) {
    return "analytical";
  }
  if (
    dept.includes("creative") ||
    dept.includes("design") ||
    dept.includes("content") ||
    dept.includes("marketing")
  ) {
    return "creative";
  }
  return "office";
}

export const TRACKS: Record<Exclude<AssessmentTrack, "none">, TrackConfig> = {
  office: {
    track: "office",
    title: "Office & Support Skills Check",
    blurb:
      "A short check on the everyday skills behind this role — email handling, scheduling, data accuracy and the tools you would use day to day.",
    duration: "About 5–8 minutes",
    questions: [
      {
        id: "office-1",
        prompt:
          "You start your day and find 40 unread emails. Which do you handle first?",
        options: [
          "A client email asking for an update on a deliverable that was due yesterday",
          "A team-wide newsletter from leadership",
          "A promotional email from a software vendor",
          "A social media notification about a post you are tagged in",
        ],
        correctIndex: 0,
      },
      {
        id: "office-2",
        prompt:
          "A colleague books a meeting on your calendar that clashes with a pre-scheduled client call. What is the best response?",
        options: [
          "Accept the new meeting and skip the client call",
          "Decline the new meeting and move on",
          "Decline the new meeting with a note, and suggest two times that work for you",
          "Accept both and let whoever shows up sort it out",
        ],
        correctIndex: 2,
      },
      {
        id: "office-3",
        prompt:
          "You are entering client names into a database. Which of these entries is most likely to cause a problem later?",
        options: [
          "Maria Santos — santos.maria@example.com",
          "JOHN SMITH — john.smith@example.com",
          "Ana-Lucia Pereira — anna.pereira@example.com",
          "Kwame Mensah — kwame.mensah@example.com",
        ],
        correctIndex: 2,
      },
      {
        id: "office-4",
        prompt:
          "Which tool is built for collaborating on a shared document that several people edit at the same time?",
        options: ["Excel (offline)", "Google Docs", "Slack", "Photoshop"],
        correctIndex: 1,
      },
    ],
    scenario: {
      prompt:
        "Your manager leaves at 2pm and asks you to handle her inbox for the afternoon. Before she leaves she says: “Please make sure the Acme account gets a reply today — they are waiting on us.” Just after she leaves, you spot an urgent-looking email from a different client asking for pricing that you are not allowed to share. What do you do, and why?",
      placeholder: "Describe the steps you would take, in order…",
    },
  },
  technical: {
    track: "technical",
    title: "Technical Fundamentals Check",
    blurb:
      "A quick pass over the core technical habits behind this role — debugging, version control, APIs and security hygiene.",
    duration: "About 6–10 minutes",
    questions: [
      {
        id: "tech-1",
        prompt:
          "A web app you support started returning 500 errors this morning. What is the first thing you should do?",
        options: [
          "Restart the server immediately",
          "Reproduce the error and check the server logs for the stack trace",
          "Email the whole team that the app is down",
          "Blame the last change that was deployed",
        ],
        correctIndex: 1,
      },
      {
        id: "tech-2",
        prompt:
          "In Git, which command adds your changed files to the staging area before committing?",
        options: ["git status", "git commit -m", "git add", "git push"],
        correctIndex: 2,
      },
      {
        id: "tech-3",
        prompt:
          "You call an API and get HTTP 401. What does that response mean?",
        options: [
          "The server is down",
          "The request was successful",
          "The endpoint does not exist",
          "Authentication is required or failed",
        ],
        correctIndex: 3,
      },
      {
        id: "tech-4",
        prompt:
          "Which of these is the strongest password practice for a company account?",
        options: [
          "Using the same password as your personal accounts so you remember it",
          "A short, easy password like “Tech2026!”",
          "A unique password stored in a password manager, with 2-factor authentication enabled",
          "Writing the password on a sticky note on your monitor",
        ],
        correctIndex: 2,
      },
    ],
    scenario: {
      prompt:
        "A user reports: “When I click the Export button, nothing happens — no error, no file.” Describe, step by step, how you would investigate this issue to find the cause. What would you check first, and how would you confirm the fix before telling the user it is resolved?",
      placeholder:
        "Walk through your investigation as if you were doing it live…",
    },
  },
  analytical: {
    track: "analytical",
    title: "Analytical & Numbers Check",
    blurb:
      "A short check on the analytical habits behind this role — working with numbers, spreadsheets and decisions based on data.",
    duration: "About 6–10 minutes",
    questions: [
      {
        id: "ana-1",
        prompt:
          "In a spreadsheet, which formula correctly adds up the values in cells A1 through A10?",
        options: ["=ADD(A1:A10)", "=SUM(A1:A10)", "=TOTAL(A1:A10)", "=A1+A10"],
        correctIndex: 1,
      },
      {
        id: "ana-2",
        prompt:
          "A store sold 120 units on Monday, 80 on Tuesday and 100 on Wednesday. What is the average number of units sold per day?",
        options: ["90", "100", "110", "300"],
        correctIndex: 1,
      },
      {
        id: "ana-3",
        prompt:
          "A company reports $500,000 in revenue and $300,000 in costs. Which statement is correct?",
        options: [
          "Profit is $800,000",
          "Profit is $200,000",
          "Profit is $300,000",
          "Profit cannot be calculated from this information",
        ],
        correctIndex: 1,
      },
      {
        id: "ana-4",
        prompt:
          "You are reviewing spending and need to reduce costs. Which line item deserves attention first?",
        options: [
          "The smallest cost that no one has noticed",
          "The largest cost that changes little month to month",
          "The cost you personally use the most",
          "The first cost listed alphabetically",
        ],
        correctIndex: 1,
      },
    ],
    scenario: {
      prompt:
        "Your manager sends you a spreadsheet with sales by region for the last six months and asks: “Where should we focus next quarter?” Describe how you would approach the data and what you would look for to give a well-supported answer.",
      placeholder:
        "Explain your approach to reading the numbers and forming a conclusion…",
    },
  },
  creative: {
    track: "creative",
    title: "Creative & Communication Check",
    blurb:
      "A short check on the creative instincts behind this role — design fundamentals, messaging and brand consistency.",
    duration: "About 5–8 minutes",
    questions: [
      {
        id: "cre-1",
        prompt:
          "A landing page feels cluttered and hard to read. Which design principle would most improve it?",
        options: [
          "Using more colors",
          "Adding more images",
          "Clear visual hierarchy — strong headings and generous spacing",
          "Making all text bold",
        ],
        correctIndex: 2,
      },
      {
        id: "cre-2",
        prompt:
          "Which channel is typically the best first choice for building awareness of a new product with a limited budget?",
        options: [
          "Social media content tailored to the audience",
          "A printed brochure mailed to everyone",
          "Billboard advertising",
          "Cold-calling every name in a phone book",
        ],
        correctIndex: 0,
      },
      {
        id: "cre-3",
        prompt: "What is the single most important job of a headline on an ad?",
        options: [
          "To be clever and funny",
          "To be long and detailed",
          "To use as many keywords as possible",
          "To clearly state the benefit in a way the reader immediately understands",
        ],
        correctIndex: 3,
      },
      {
        id: "cre-4",
        prompt:
          "Before publishing content on behalf of a brand, what should you always check first?",
        options: [
          "Whether your personal opinion comes through clearly",
          "The brand guidelines — tone, logo usage and approved colors",
          "How many likes the last post got",
          "Whether the post is longer than the last one",
        ],
        correctIndex: 1,
      },
    ],
    scenario: {
      prompt:
        "The brand is launching a new customer service feature and needs a short social media caption (2–3 sentences) plus one visual idea. Write the caption and describe the visual you would pair with it.",
      placeholder:
        "Write your caption here, then add one line describing your visual idea…",
    },
  },
};

export function scoreResponses(
  config: TrackConfig,
  answers: Record<string, number | undefined>,
): { score: number; maxScore: number } {
  const maxScore = config.questions.length;
  let score = 0;
  for (const q of config.questions) {
    if (answers[q.id] === q.correctIndex) score += 1;
  }
  return { score, maxScore };
}
