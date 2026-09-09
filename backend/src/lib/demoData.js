// The demo dataset, shared by the in-memory mock and the real-Supabase seed
// script so a hosted demo looks exactly like the local one.
// Centred on Durgapur, West Bengal so the map opens somewhere real.

export const CENTRE = { lat: 23.5204, lng: 87.3119 };
const DAY = 24 * 60 * 60 * 1000;

export const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
export const hoursFromNow = (n) => new Date(Date.now() + n * 60 * 60 * 1000).toISOString();

// Offsets are in degrees; ~0.009 lat is roughly 1km at this latitude.
export const offset = (km, bearingDeg) => {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: CENTRE.lat + (km / 111.2) * Math.cos(rad),
    lng: CENTRE.lng + (km / (111.2 * Math.cos((CENTRE.lat * Math.PI) / 180))) * Math.sin(rad),
  };
};

export const SEED_ACCOUNTS = [
  {
    email: "admin@blooddrop.test",
    password: "Admin123!",
    name: "Network Admin",
    role: "admin",
    phone: "+91 90000 00001",
  },
  {
    email: "donor@blooddrop.test",
    password: "Donor123!",
    name: "Sam Donor",
    role: "donor",
    phone: "+91 90000 00002",
    donor: { group: "O+", km: 0.8, bearing: 45, last: 120, pref: "email", stats: [6, 5, 2, 0] },
  },
  {
    email: "hospital@blooddrop.test",
    password: "Hospital123!",
    name: "Dr. Aisha Roy",
    role: "requester",
    phone: "+91 90000 00003",
    organization: "Durgapur Mission Hospital",
    orgType: "hospital",
    verified: true,
  },
  {
    email: "requester@blooddrop.test",
    password: "Requester123!",
    name: "Rohit Verma",
    role: "requester",
    phone: "+91 90000 00004",
  },
];

// name, group, km, bearing, daysSinceLastDonation (null = never), preference,
// [alerts, responses, donations, noShows], paused
export const SEED_DONORS = [
  ["Ananya Bose", "O+", 1.2, 20, 200, "sms", [9, 8, 4, 0], false],
  ["Rahul Mondal", "O+", 3.4, 110, 40, "email", [5, 3, 1, 0], false],
  ["Sneha Dutta", "A+", 2.1, 200, null, "email", [0, 0, 0, 0], false],
  ["Imran Khan", "O-", 4.8, 75, 130, "sms", [12, 12, 7, 0], false],
  ["Priya Sharma", "B+", 6.5, 300, null, "inapp", [2, 1, 0, 0], false],
  ["Arjun Ghosh", "A-", 8.2, 150, 300, "email", [7, 5, 3, 1], false],
  ["Meera Iyer", "AB+", 11.4, 250, 95, "sms", [4, 3, 2, 0], false],
  ["Sourav Roy", "B-", 14.0, 30, null, "inapp", [8, 2, 0, 2], false],
  ["Fatima Sheikh", "O+", 18.5, 190, 500, "email", [6, 6, 5, 0], false],
  ["Vikram Nair", "A+", 22.0, 95, 60, "sms", [3, 2, 1, 0], false],
  ["Kabir Das", "O-", 9.1, 340, null, "email", [3, 2, 1, 0], false],
  ["Ritu Banerjee", "O-", 12.3, 15, 210, "inapp", [6, 4, 2, 0], false],
  ["Nandini Pal", "AB-", 5.5, 60, 400, "inapp", [5, 4, 2, 0], false],
  ["Tanvi Reddy", "B+", 7.7, 220, 15, "email", [4, 4, 3, 0], false],
  ["Deep Chatterjee", "O+", 25.5, 130, 180, "sms", [10, 7, 4, 1], true],
];


export const AREAS = ["City Centre", "Benachity", "Steel Township", "Muchipara", "Rajbandh", "Kanksa"];

export const DEMO_PASSWORD = "Donor123!";
