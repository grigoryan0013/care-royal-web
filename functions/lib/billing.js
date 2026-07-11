// Shared billing math.
export function shiftHours(shift) {
  if (!shift.clockIn || !shift.clockOut) return 0;
  const ms = new Date(shift.clockOut).getTime() - new Date(shift.clockIn).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

// Client-facing charge for a completed shift, from the service rate + model.
export function invoiceAmount(service, shift) {
  const rate = parseFloat(service?.rate || "0") || 0;
  if (!rate) return 0;
  if (service.pricingModel === "hourly") {
    const h = shiftHours(shift);
    return Math.round(rate * (h || 1) * 100) / 100;
  }
  return Math.round(rate * 100) / 100; // visit / flat / session / night / day / trip / walk / week
}

// Caregiver gross pay for a completed shift, from the caregiver's own rate.
export function payAmount(caregiverRate, shift) {
  const rate = parseFloat(caregiverRate || "0") || 0;
  if (!rate) return 0;
  const h = shiftHours(shift);
  return Math.round(rate * (h || 1) * 100) / 100;
}
