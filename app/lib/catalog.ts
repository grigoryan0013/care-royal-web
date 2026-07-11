// Default Care Royal service catalog (client copy).
// rates and toggles services on/off. profileType: person|pet|home.
// pricingModel: hourly|visit|night|day|session|walk|trip|week|flat.
// credential: none|caregiver|lvn_rn|therapist.
export const DEFAULT_SERVICES = [
  // A. Personal & senior care
  ["Personal & senior care", "Bathing, dressing & grooming", "person", "hourly", "caregiver", 120],
  ["Personal & senior care", "Toileting / incontinence care", "person", "hourly", "caregiver", 60],
  ["Personal & senior care", "Mobility & transfer assistance", "person", "hourly", "caregiver", 60],
  ["Personal & senior care", "Feeding assistance", "person", "hourly", "caregiver", 60],
  ["Personal & senior care", "Medication reminders", "person", "visit", "caregiver", 30],
  ["Personal & senior care", "Fall-risk / safety supervision", "person", "hourly", "caregiver", 120],
  ["Personal & senior care", "Overnight care (awake)", "person", "night", "caregiver", 480],
  ["Personal & senior care", "Live-in care", "person", "day", "caregiver", 1440],
  // B. Companion & non-medical
  ["Companion & non-medical", "Companionship", "person", "hourly", "none", 120],
  ["Companion & non-medical", "Meal preparation", "person", "hourly", "none", 90],
  ["Companion & non-medical", "Light housekeeping", "person", "hourly", "none", 90],
  ["Companion & non-medical", "Laundry & linens", "person", "hourly", "none", 90],
  ["Companion & non-medical", "Grocery shopping / errands", "person", "visit", "none", 90],
  ["Companion & non-medical", "Medication pickup", "person", "visit", "none", 45],
  ["Companion & non-medical", "Appointment escort", "person", "hourly", "none", 120],
  ["Companion & non-medical", "Technology help", "person", "visit", "none", 45],
  // C. Skilled / medical home health
  ["Skilled home health", "Skilled nursing visit", "person", "visit", "lvn_rn", 60],
  ["Skilled home health", "Wound care", "person", "visit", "lvn_rn", 45],
  ["Skilled home health", "Medication administration / injections", "person", "visit", "lvn_rn", 30],
  ["Skilled home health", "Vitals monitoring", "person", "visit", "lvn_rn", 30],
  ["Skilled home health", "Post-surgery / post-hospital recovery", "person", "hourly", "lvn_rn", 120],
  ["Skilled home health", "Physical therapy", "person", "session", "therapist", 60],
  ["Skilled home health", "Occupational therapy", "person", "session", "therapist", 60],
  ["Skilled home health", "Speech therapy", "person", "session", "therapist", 60],
  ["Skilled home health", "Chronic disease management", "person", "visit", "lvn_rn", 45],
  // D. Specialized condition care
  ["Specialized condition care", "Dementia & Alzheimer's care", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Parkinson's care", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Stroke recovery care", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Hospice / end-of-life support", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Palliative support", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Disability & special-needs care", "person", "hourly", "caregiver", 240],
  ["Specialized condition care", "Post-partum / newborn care", "person", "hourly", "caregiver", 240],
  // E. Child care
  ["Child care", "Nanny / full-day child care", "person", "hourly", "caregiver", 480],
  ["Child care", "Babysitting", "person", "hourly", "none", 180],
  ["Child care", "After-school care", "person", "hourly", "none", 180],
  ["Child care", "Newborn / infant care", "person", "hourly", "caregiver", 240],
  ["Child care", "Special-needs child care", "person", "hourly", "caregiver", 240],
  ["Child care", "Tutoring / homework help", "person", "session", "none", 60],
  // F. Pet care
  ["Pet care", "Dog walking", "pet", "walk", "none", 30],
  ["Pet care", "Pet sitting (visit)", "pet", "visit", "none", 45],
  ["Pet care", "Overnight pet sitting", "pet", "night", "none", 720],
  ["Pet care", "Feeding / medication for pets", "pet", "visit", "none", 30],
  ["Pet care", "Vet appointment transport", "pet", "trip", "none", 90],
  ["Pet care", "Grooming coordination", "pet", "visit", "none", 60],
  // G. Household & home services
  ["Household & home services", "Deep cleaning", "home", "flat", "none", 240],
  ["Household & home services", "Recurring housekeeping", "home", "hourly", "none", 120],
  ["Household & home services", "Yard / lawn care", "home", "flat", "none", 120],
  ["Household & home services", "Handyman / minor repairs", "home", "hourly", "none", 120],
  ["Household & home services", "Home safety check / setup", "home", "visit", "none", 90],
  ["Household & home services", "Meal delivery coordination", "home", "week", "none", 0],
  ["Household & home services", "Home organization", "home", "hourly", "none", 180],
  // H. Respite & family support
  ["Respite & family support", "Respite care", "person", "hourly", "caregiver", 240],
  ["Respite & family support", "Weekend / holiday coverage", "person", "day", "caregiver", 1440],
  ["Respite & family support", "Emergency / same-day care", "person", "hourly", "caregiver", 120],
  ["Respite & family support", "Facility / hospital sitter", "person", "hourly", "caregiver", 240],
  // I. Transportation
  ["Transportation", "Medical appointment transport", "person", "trip", "none", 120],
  ["Transportation", "Errand / shopping transport", "person", "trip", "none", 90],
  ["Transportation", "Social / event transport", "person", "trip", "none", 120],
  ["Transportation", "Wheelchair-accessible transport", "person", "trip", "caregiver", 120],
  ["Transportation", "Airport / long-distance", "person", "flat", "none", 180],
  // J. Wellness add-ons
  ["Wellness add-ons", "In-home haircut / salon", "person", "visit", "none", 60],
  ["Wellness add-ons", "Massage / mobility therapy", "person", "session", "therapist", 60],
  ["Wellness add-ons", "Fitness / exercise assistance", "person", "hourly", "caregiver", 60],
  ["Wellness add-ons", "Nutrition / meal planning", "person", "session", "none", 60],
  ["Wellness add-ons", "Social engagement / activity visits", "person", "hourly", "none", 120],
].map(([category, name, profileType, pricingModel, credential, durationMin]) => ({
  category, name, profileType, pricingModel, credential, durationMin,
}));
