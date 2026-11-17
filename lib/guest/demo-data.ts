import type { Locale } from "@/lib/i18n/config";
import type { TreatmentColor } from "@/lib/scheduling/colors";

/**
 * The fictional clinic every guest starts with ("Try it as a guest").
 * Names, phone numbers and ID numbers belong to no one: phones are in a
 * made-up 050-0000xxx range, emails use example.test, and ID numbers are
 * built from a fixed base so they pass the check-digit test without being
 * anyone's.
 */

export type DemoTreatment = {
  key: "reflexology" | "massage" | "consult";
  name: string;
  durationMinutes: number;
  priceAgorot: number | null;
  color: TreatmentColor;
  bookableOnline: boolean;
};

export type DemoPatient = {
  key: string;
  fullName: string;
  medicalBackground: string | null;
  importantNotes: string | null;
  treatments: DemoTreatment["key"][];
  preferredLocale: Locale;
};

/** An appointment `dayOffset` days from today, at `time` in the clinic's zone. */
export type DemoAppointment = {
  patient: string;
  treatment: DemoTreatment["key"];
  dayOffset: number;
  time: string;
  /** Past sessions: summary versions, oldest first (none = summary missing). */
  summaries?: string[];
  /** A request from the booking page, waiting for approval. */
  onlineRequest?: boolean;
};

type DemoContent = {
  clinicName: string;
  treatments: DemoTreatment[];
  patients: DemoPatient[];
  appointments: DemoAppointment[];
};

const he: DemoContent = {
  clinicName: "קליניקת הדגמה",
  treatments: [
    {
      key: "reflexology",
      name: "רפלקסולוגיה",
      durationMinutes: 60,
      priceAgorot: 25000,
      color: "teal",
      bookableOnline: true,
    },
    {
      key: "massage",
      name: "עיסוי רפואי",
      durationMinutes: 45,
      priceAgorot: 20000,
      color: "blue",
      bookableOnline: true,
    },
    {
      key: "consult",
      name: "פגישת ייעוץ",
      durationMinutes: 30,
      priceAgorot: null,
      color: "violet",
      bookableOnline: false,
    },
  ],
  patients: [
    {
      key: "noa",
      fullName: "נועה לוי",
      medicalBackground: "כאבי גב תחתון כרוניים. ניתוח ברך ב-2019.",
      importantNotes: "רגישות לשמן לבנדר.",
      treatments: ["reflexology"],
      preferredLocale: "he",
    },
    {
      key: "daniel",
      fullName: "דניאל כהן",
      medicalBackground: "מתח בכתפיים מעבודה מול מחשב.",
      importantNotes: null,
      treatments: ["massage"],
      preferredLocale: "he",
    },
    {
      key: "michal",
      fullName: "מיכל אברהם",
      medicalBackground: "מיגרנות חוזרות, נוטלת טיפול מונע.",
      importantNotes: null,
      treatments: ["consult", "reflexology"],
      preferredLocale: "he",
    },
    {
      key: "yossi",
      fullName: "יוסי מזרחי",
      medicalBackground: "החלמה מנקע בקרסול.",
      importantNotes: "סוכרת סוג 2 – לשאול על רמות הסוכר לפני טיפול.",
      treatments: ["massage"],
      preferredLocale: "he",
    },
    {
      key: "ronit",
      fullName: "רונית שפירא",
      medicalBackground: null,
      importantNotes: null,
      treatments: ["reflexology"],
      preferredLocale: "he",
    },
    {
      key: "uri",
      fullName: "Uri Ben-David",
      medicalBackground: "Plantar fasciitis in the right foot.",
      importantNotes: null,
      treatments: ["reflexology"],
      preferredLocale: "en",
    },
  ],
  appointments: [
    {
      patient: "noa",
      treatment: "reflexology",
      dayOffset: -7,
      time: "10:00",
      summaries: [
        "טיפול ראשון. עבודה על אזורי הגב התחתון בכף הרגל. המטופלת דיווחה על הקלה קלה.",
        "טיפול ראשון. עבודה על אזורי הגב התחתון בכף הרגל. המטופלת דיווחה על הקלה קלה. המלצה: מתיחות יומיות של 10 דקות ושתייה מרובה.",
      ],
    },
    {
      patient: "daniel",
      treatment: "massage",
      dayOffset: -5,
      time: "12:00",
      summaries: [
        "עיסוי ממוקד בטרפז ובשכמות. טווח התנועה בצוואר השתפר בסוף הטיפול.",
      ],
    },
    {
      patient: "michal",
      treatment: "consult",
      dayOffset: -3,
      time: "09:00",
      summaries: [
        "פגישת היכרות. בניית תוכנית של 6 טיפולי רפלקסולוגיה, פעם בשבוע.",
      ],
    },
    // A past session still waiting for its summary.
    { patient: "yossi", treatment: "massage", dayOffset: -2, time: "15:00" },
    // Today, so the calendar and the dashboard never open empty. Whichever
    // have already started when the guest arrives count as done.
    { patient: "ronit", treatment: "reflexology", dayOffset: 0, time: "09:00" },
    { patient: "uri", treatment: "reflexology", dayOffset: 0, time: "11:30" },
    { patient: "daniel", treatment: "massage", dayOffset: 0, time: "14:00" },
    { patient: "michal", treatment: "consult", dayOffset: 0, time: "16:30" },
    { patient: "noa", treatment: "reflexology", dayOffset: 1, time: "10:00" },
    { patient: "ronit", treatment: "reflexology", dayOffset: 1, time: "13:00" },
    { patient: "uri", treatment: "reflexology", dayOffset: 2, time: "11:00" },
    {
      patient: "yossi",
      treatment: "massage",
      dayOffset: 2,
      time: "16:00",
      onlineRequest: true,
    },
    { patient: "daniel", treatment: "massage", dayOffset: 3, time: "09:30" },
    {
      patient: "michal",
      treatment: "reflexology",
      dayOffset: 4,
      time: "14:00",
    },
  ],
};

const en: DemoContent = {
  clinicName: "Demo Clinic",
  treatments: [
    { ...he.treatments[0], name: "Reflexology" },
    { ...he.treatments[1], name: "Medical massage" },
    { ...he.treatments[2], name: "Consultation" },
  ],
  patients: [
    {
      ...he.patients[0],
      fullName: "Noa Levi",
      medicalBackground: "Chronic lower back pain. Knee surgery in 2019.",
      importantNotes: "Sensitive to lavender oil.",
      preferredLocale: "en",
    },
    {
      ...he.patients[1],
      fullName: "Daniel Cohen",
      medicalBackground: "Shoulder tension from desk work.",
      preferredLocale: "en",
    },
    {
      ...he.patients[2],
      fullName: "Michal Abraham",
      medicalBackground: "Recurring migraines, on preventive medication.",
      preferredLocale: "en",
    },
    {
      ...he.patients[3],
      fullName: "Yossi Mizrahi",
      medicalBackground: "Recovering from a sprained ankle.",
      importantNotes:
        "Type 2 diabetes – ask about blood sugar before treatment.",
      preferredLocale: "en",
    },
    {
      ...he.patients[4],
      fullName: "Ronit Shapira",
      preferredLocale: "en",
    },
    { ...he.patients[5] },
  ],
  appointments: he.appointments.map((appointment) => {
    const english: Record<string, string[]> = {
      noa: [
        "First session. Worked on the lower-back zones of the foot. Patient reported slight relief.",
        "First session. Worked on the lower-back zones of the foot. Patient reported slight relief. Recommended: 10 minutes of daily stretching and plenty of water.",
      ],
      daniel: [
        "Focused massage on the trapezius and shoulder blades. Neck range of motion improved by the end.",
      ],
      michal: ["Introductory meeting. Planned 6 weekly reflexology sessions."],
    };
    return appointment.summaries
      ? { ...appointment, summaries: english[appointment.patient] }
      : appointment;
  }),
};

export function demoContent(locale: Locale): DemoContent {
  return locale === "he" ? he : en;
}

/** A check-digit-valid Israeli ID number that belongs to no one. */
export function demoNationalId(index: number): string {
  // Base 0000000xx: real ID numbers aren't issued this low.
  const base = String(10 + index).padStart(8, "0");
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let step = Number(base[i]) * ((i % 2) + 1);
    if (step > 9) step -= 9;
    sum += step;
  }
  return `${base}${(10 - (sum % 10)) % 10}`;
}

/** 050-0000101, 050-0000102, … (E.164). */
export function demoPhone(index: number): string {
  return `+9725000001${String(index + 1).padStart(2, "0")}`;
}
