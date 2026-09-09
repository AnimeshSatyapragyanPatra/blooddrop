// Blood group domain rules: what counts as a valid group, and who can give to whom.

export const BLOOD_GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

// For a patient of group X, the donor groups that are safe for a red-cell transfusion.
// O- is the universal donor; AB+ is the universal recipient.
const COMPATIBLE_DONORS = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": BLOOD_GROUPS,
};

export function isBloodGroup(value) {
  return BLOOD_GROUPS.includes(value);
}

/** Donor groups that can safely give to a patient needing `patientGroup`. */
export function compatibleDonorGroups(patientGroup) {
  return COMPATIBLE_DONORS[patientGroup] || [];
}

/** True when `donorGroup` blood can be given to a `patientGroup` patient. */
export function canDonate(donorGroup, patientGroup) {
  return compatibleDonorGroups(patientGroup).includes(donorGroup);
}
