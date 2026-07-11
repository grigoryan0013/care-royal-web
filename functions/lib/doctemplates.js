// Document templates rendered server-side with household/recipient details.
// Kept as plain text with simple headings; the signature + audit trail are added
// on signing. No third-party e-sign dependency.
export const TEMPLATES = {
  service_agreement: "Service Agreement",
  care_plan: "Care Plan",
  consent: "Consent to Care",
  hipaa: "HIPAA Acknowledgment",
};

export function renderTemplate(key, ctx) {
  const { agencyName = "Care Royal", householdName = "", recipientName = "", date = new Date().toLocaleDateString() } = ctx || {};
  switch (key) {
    case "service_agreement":
      return [
        `SERVICE AGREEMENT`,
        ``,
        `This agreement is between ${agencyName} ("Agency") and ${householdName || "the Client"} ("Client"), dated ${date}.`,
        ``,
        `1. Services. The Agency will coordinate care services requested through the Care Royal platform and approved by the Agency.`,
        `2. Scheduling. Services are scheduled through the platform. The Client may request changes subject to Agency approval and caregiver availability.`,
        `3. Payment. The Client authorizes charges for approved and completed services to the payment method on file, billed by the Agency.`,
        `4. Cancellation. The Client may cancel a scheduled visit in advance; late cancellations may be billed per Agency policy.`,
        `5. Caregivers. Caregivers are engaged by the Agency. The Client will provide a safe environment and accurate care information.`,
        `6. Term. This agreement remains in effect while the Client uses the Agency's services.`,
        ``,
        `By signing, the Client agrees to the terms above.`,
      ].join("\n");
    case "care_plan":
      return [
        `CARE PLAN`,
        ``,
        `Client household: ${householdName}`,
        `Care recipient: ${recipientName}`,
        `Date: ${date}`,
        ``,
        `Care goals and instructions are maintained by the Agency and visible to assigned caregivers. This plan documents the agreed scope of care and is reviewed periodically.`,
        ``,
        `By signing, the Client acknowledges and approves this care plan.`,
      ].join("\n");
    case "consent":
      return [
        `CONSENT TO CARE`,
        ``,
        `I, on behalf of ${recipientName || householdName}, consent to the care services coordinated by ${agencyName} and delivered by its caregivers, effective ${date}.`,
        ``,
        `I understand I may withdraw this consent at any time in writing.`,
      ].join("\n");
    case "hipaa":
      return [
        `HIPAA ACKNOWLEDGMENT`,
        ``,
        `I acknowledge that ${agencyName} may use and disclose health information as necessary to coordinate and deliver care, consistent with applicable privacy law, effective ${date}.`,
      ].join("\n");
    default:
      return `${TEMPLATES[key] || "Document"}\n\nDated ${date}.`;
  }
}
