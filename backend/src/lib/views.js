// Row -> API shape mappers shared between controllers.
import { eligibility } from "./eligibility.js";
import { reliabilityView } from "./reliability.js";

export function donorView(donor) {
  if (!donor) return null;
  return {
    bloodGroup: donor.blood_group,
    lat: donor.lat,
    lng: donor.lng,
    areaLabel: donor.area_label,
    lastDonationDate: donor.last_donation_date,
    contactPref: donor.contact_pref,
    paused: Boolean(donor.paused),
    eligibility: eligibility(donor.last_donation_date),
    reliability: reliabilityView(donor),
  };
}
