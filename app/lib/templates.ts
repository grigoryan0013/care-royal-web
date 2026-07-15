// Care Royal assistant — deterministic, template + rule based. No external AI
// key or network call: care plans, visit-note summaries with risk flags, family
// updates and intake parsing are generated entirely in code so every agency gets
// them out of the box. fb.ts and demo.ts both route /api/ai through generate().

type Input = Record<string, any>;

// ---- condition knowledge base (keyword -> care guidance) ------------------
interface Guide { label: string; goals: string[]; interventions: string[]; safety: string[] }
const CONDITIONS: { match: RegExp; g: Guide }[] = [
  { match: /diabet|blood sugar|insulin|glucose/i, g: { label: "Diabetes", goals: ["Maintain stable blood sugar", "Support a consistent, balanced diet"], interventions: ["Prompt and observe blood-sugar checks per the family/physician schedule", "Support medication and insulin timing", "Prepare diabetic-appropriate meals and snacks", "Inspect feet for sores or swelling during personal care"], safety: ["Watch for signs of low/high blood sugar (shakiness, confusion, excessive thirst) and report promptly"] } },
  { match: /mobilit|fall|transfer|walk|gait|wheelchair|weak/i, g: { label: "Mobility & fall risk", goals: ["Prevent falls", "Maintain safe mobility and independence"], interventions: ["Assist with transfers and ambulation using proper technique", "Keep walkways clear and well lit", "Ensure assistive devices are within reach"], safety: ["Fall-risk precautions in place; keep frequently used items within easy reach", "Report any fall, near-fall or new unsteadiness immediately"] } },
  { match: /dementia|alzheimer|memory|cognit|confus/i, g: { label: "Dementia / memory care", goals: ["Provide a calm, consistent routine", "Preserve dignity and reduce agitation"], interventions: ["Maintain a predictable daily routine", "Use gentle redirection and simple, clear communication", "Provide orientation cues (calendar, clock, familiar objects)"], safety: ["Ensure doors/exits are secured to prevent wandering", "Remove or secure hazards (stove, sharp objects) when unsupervised"] } },
  { match: /parkinson/i, g: { label: "Parkinson's care", goals: ["Support mobility and medication timing"], interventions: ["Assist with timed medication doses (timing is critical)", "Allow extra time for movement and meals", "Encourage prescribed exercises"], safety: ["Fall precautions during 'off' periods and freezing episodes"] } },
  { match: /stroke|cva|hemipleg/i, g: { label: "Stroke recovery", goals: ["Support regained function and independence"], interventions: ["Assist affected-side care and prescribed exercises", "Support communication if speech is affected", "Encourage medication adherence (blood pressure, blood thinners)"], safety: ["Monitor for stroke warning signs (FAST) and call 911 if they appear"] } },
  { match: /hospice|palliat|end.of.life|terminal/i, g: { label: "Hospice / palliative support", goals: ["Maximize comfort and dignity", "Support the family"], interventions: ["Provide gentle personal care and repositioning for comfort", "Coordinate with the hospice team on symptom relief", "Offer emotional presence to client and family"], safety: ["Report uncontrolled pain or distress to the hospice nurse right away"] } },
  { match: /incontinen|toilet|bladder|bowel/i, g: { label: "Continence care", goals: ["Maintain hygiene, skin integrity and dignity"], interventions: ["Provide scheduled toileting and prompt changes", "Perform thorough skin care and check for redness"], safety: ["Report any skin breakdown, redness or signs of infection"] } },
  { match: /medic|pill|prescription|rx/i, g: { label: "Medication support", goals: ["Support safe, on-time medication use"], interventions: ["Provide medication reminders per the schedule", "Confirm medications are taken and log as required", "Flag refills before they run out"], safety: ["Never adjust doses; report missed doses or side effects to the agency/family"] } },
  { match: /copd|oxygen|breath|respirat|asthma/i, g: { label: "Respiratory care", goals: ["Support comfortable breathing and activity pacing"], interventions: ["Assist with oxygen equipment and positioning", "Pace activities to avoid breathlessness"], safety: ["Keep oxygen away from heat/flame; report increased shortness of breath"] } },
  { match: /wound|ulcer|pressure sore|dressing/i, g: { label: "Wound care", goals: ["Support healing and prevent infection"], interventions: ["Support prescribed dressing changes (skilled nurse as required)", "Reposition regularly to relieve pressure"], safety: ["Report increased redness, drainage, odor or fever"] } },
  { match: /vision|blind|low.sight/i, g: { label: "Low-vision support", goals: ["Maintain a safe, consistent environment"], interventions: ["Keep the environment consistent and clutter-free", "Use verbal cues and describe surroundings"], safety: ["Ensure good lighting and clear pathways"] } },
  { match: /post.?partum|newborn|infant|baby/i, g: { label: "Newborn / post-partum", goals: ["Support recovery of the parent and care of the newborn"], interventions: ["Assist with newborn feeding, changing and soothing", "Support the parent's rest and recovery"], safety: ["Follow safe-sleep practices; report any concerns about the baby or parent"] } },
];
const PET = /\bpet|dog|cat|animal\b/i;
const HOME = /\bhome|house|residence|cleaning|yard\b/i;

function bullets(list: string[]): string { return list.map((x) => `  - ${x}`).join("\n"); }
const uniq = (a: string[]) => Array.from(new Set(a));
const today = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

function carePlan(i: Input): string {
  const name = (i.recipientName || "the care recipient").toString().trim();
  const cond = (i.conditions || "").toString().trim();
  const services = (i.services || "").toString().trim();
  const freq = (i.frequency || "as scheduled").toString().trim();
  const matched = CONDITIONS.filter((c) => c.match.test(cond));
  const goals = uniq([...matched.flatMap((m) => m.g.goals), "Support activities of daily living as needed", "Provide companionship and monitor overall wellbeing"]);
  const safety = uniq([...matched.flatMap((m) => m.g.safety), "Report any change in condition, mood or appetite to the agency and family"]);
  const secBits: string[] = [];
  for (const m of matched) secBits.push(`${m.g.label}\n${bullets(m.g.interventions)}`);
  return [
    "CARE PLAN",
    `Prepared: ${today()}`,
    `Care recipient: ${name}`,
    cond ? `Presenting conditions: ${cond}` : "Presenting conditions: general assistance",
    "",
    "CARE GOALS",
    bullets(goals),
    "",
    "SERVICES & SCHEDULE",
    bullets([services ? `Services: ${services}` : "Services: personal care, companionship, light housekeeping", `Frequency: ${freq}`]),
    "",
    secBits.length ? "CONDITION-SPECIFIC CARE\n" + secBits.join("\n\n") : "CONDITION-SPECIFIC CARE\n  - Standard supportive care; tailor to the recipient's daily needs.",
    "",
    "SAFETY & RISK",
    bullets(safety),
    "",
    "COMMUNICATION & REVIEW",
    bullets(["Caregiver logs each visit; agency reviews notes for changes", "Family is updated on significant changes", "Care plan reviewed regularly and after any change in condition"]),
    "",
    "By signing, the client/representative acknowledges and approves this care plan.",
    "",
    "Client / representative: ______________________    Date: __________",
  ].join("\n");
}

// ---- visit-note summary + risk flags --------------------------------------
const RISK: { label: string; re: RegExp }[] = [
  { label: "Fall / mobility", re: /\b(fell|fall|fallen|slip|trip|stumbl|unsteady|dizz|lightheaded)\b/i },
  { label: "Pain", re: /\b(pain|ache|hurt|sore|discomfort|cramp)\b/i },
  { label: "Skin / wound", re: /\b(redness|bruise|sore|wound|rash|swell|skin break)\b/i },
  { label: "Behavioral / mood", re: /\b(agitat|confus|anxious|depress|withdraw|aggress|refus|combativ|wander)\b/i },
  { label: "Nutrition / hydration", re: /\b(didn'?t eat|not eating|poor appetite|refused (food|meal)|dehydrat|no fluids|skipped meal)\b/i },
  { label: "Medication", re: /\b(miss(ed)?|refus\w+|skip\w+|forgot|didn'?t take|would ?n'?t take)\b[^.!?]*\b(dose|medication|meds|pill|insulin|rx)\b/i },
  { label: "Vitals / medical", re: /\b(fever|temperature|short of breath|breathing|chest|blood pressure|bp |sugar|glucose|seizure|vomit|nausea)\b/i },
];
function summarize(i: Input): string {
  const notes = String(i.notes || "").trim();
  if (!notes) return "No visit notes provided.";
  const sentences = notes.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const flags: string[] = [];
  for (const r of RISK) {
    const hit = sentences.find((s) => r.re.test(s));
    if (hit) flags.push(`  - ${r.label}: "${hit.slice(0, 140)}"`);
  }
  const head = sentences.slice(0, 2).join(" ");
  const wc = notes.split(/\s+/).filter(Boolean).length;
  return [
    "VISIT SUMMARY",
    head || notes.slice(0, 200),
    "",
    `Key points (${sentences.length} note${sentences.length === 1 ? "" : "s"}, ${wc} words):`,
    bullets(sentences.slice(0, 6).map((s) => s.slice(0, 140))),
    "",
    "RISK FLAGS",
    flags.length ? flags.join("\n") : "  - None detected in these notes.",
    "",
    flags.length ? "Review the flagged items above and follow up as appropriate." : "No follow-up flags. Continue the current care plan.",
  ].join("\n");
}

function familyUpdate(i: Input): string {
  const fam = (i.familyName || "there").toString().trim();
  const rec = (i.recipientName || "your loved one").toString().trim();
  const activities = (i.activities || "").toString().trim();
  const mood = (i.mood || "").toString().trim();
  const next = (i.next || "").toString().trim();
  const parts = [`Hi ${fam},`, "", `Here's an update on ${rec}.`];
  if (activities) parts.push(`Today we focused on ${activities}.`);
  else parts.push(`Recent visits have gone well and care is on track.`);
  if (mood) parts.push(`${rec.split(" ")[0]} seemed ${mood} today.`);
  parts.push(`We're keeping a close eye on daily wellbeing and comfort.`);
  if (next) parts.push(`Next up: ${next}.`);
  parts.push("", "Please reach out any time with questions — we're glad to help.", "", "Warm regards,", "Your Care Royal team");
  return parts.join("\n");
}

function intake(i: Input): string {
  const t = (i.transcript || i.details || "").toString();
  const careFor = PET.test(t) ? "pet" : /\b(child|kid|son|daughter|baby|infant|toddler)\b/i.test(t) ? "child" : HOME.test(t) && !/\b(mother|father|mom|dad|husband|wife|parent|grand)\b/i.test(t) ? "home" : "person";
  const svcMap: [RegExp, string][] = [[/bath|dress|groom|hygiene|shower/i, "Personal care"], [/compan|lonely|social/i, "Companionship"], [/meal|cook|food|eat/i, "Meal preparation"], [/medic|pill|rx/i, "Medication reminders"], [/clean|housekeep|laundry/i, "Housekeeping"], [/driv|transport|appointment|ride/i, "Transportation"], [/nurs|wound|injection|skilled/i, "Skilled nursing"], [/dementia|alzheimer|memory/i, "Dementia care"], [/night|overnight|24|live.in/i, "Overnight / live-in"]];
  const services = uniq(svcMap.filter(([re]) => re.test(t)).map(([, s]) => s));
  const urgency = /\b(asap|urgen\w*|immediat\w*|today|tomorrow|right away|emergency|alone right now|can'?t wait|need\w* (someone|help) (now|today))\b/i.test(t) ? "high" : /\b(next week|soon|few days|this week)\b/i.test(t) ? "medium" : /\b(explor\w*|thinking|future|eventually|just looking|down the road)\b/i.test(t) ? "low" : "medium";
  const summary = t.replace(/\s+/g, " ").trim().slice(0, 280);
  const json = JSON.stringify({ careFor, services, urgency, summary }, null, 2);
  return ["INTAKE SUMMARY", `Care for: ${careFor}`, `Services requested: ${services.length ? services.join(", ") : "to be determined"}`, `Urgency: ${urgency}`, "", "Notes:", summary || "(none)", "", "Structured (for the pipeline):", json].join("\n");
}

export function generate(task: string, input: Input = {}): string {
  switch (task) {
    case "care_plan": return carePlan(input);
    case "summarize": return summarize(input);
    case "family_update": return familyUpdate(input);
    case "intake": return intake(input);
    default: return "Choose a task: care plan, summarize notes, family update, or intake.";
  }
}
