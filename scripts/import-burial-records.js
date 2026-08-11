#!/usr/bin/env node
/**
 * One-time (or occasional — see note below) conversion of a burial
 * register spreadsheet into data/burial-records.json, the single
 * aggregate burial-record.html/js/burial-record.js and site search
 * actually read.
 *
 * NOT part of the automatic rebuild pipeline (unlike
 * rebuild-photos-index.js etc) — there's no CMS collection behind this,
 * no per-entry editing, and the source spreadsheet isn't committed to
 * the repo. This is a bulk import of Thurmaston cemetery's burial
 * register (2,710 entries as of the file this was first run against),
 * requested explicitly to be searchable but not otherwise part of the
 * editable site content ("this file doesn't need to appear on the
 * website, however i want it embedding in the search").
 *
 * Run by hand whenever there's a new/updated spreadsheet to import:
 *   npm install xlsx --no-save   (not a permanent dependency — see below)
 *   node scripts/import-burial-records.js path/to/spreadsheet.xlsx
 *
 * Expects the same shape as the original AP_Cemetery_Records.xlsx: one
 * sheet per surname initial (A-Z), each with columns Surname,
 * First Name(s), Grave No., Date of Burial, Year, Age, Extra (in that
 * order — read by position below, not by header name, since a couple
 * of sheets have the header text duplicated with a trailing space and
 * position is more reliable than matching that exactly).
 *
 * `xlsx` isn't a permanent project dependency (this project has no
 * build step / package.json) — install it ad hoc into node_modules
 * (gitignored) each time this needs running, same "vendor a library
 * just for what needs it" approach already used for browser-side
 * libraries like jsPDF/Leaflet, just here for a one-off Node script
 * instead of something shipped to the browser.
 *
 * Data-quality handling, both discovered by inspecting the real file
 * before writing this:
 *  - "Date of Burial" is sometimes a proper Excel date, but a proper
 *    Excel date's YEAR is not to be trusted — 38 of the 2,710 rows in
 *    the original file have a Date-of-Burial year that flatly
 *    contradicts the separate, more reliable Year column (e.g. a
 *    burial dated "11 November 2014" whose own Year column says
 *    1970) — almost certainly Excel auto-completing a day/month-only
 *    typed entry with an unrelated year at some point. So: the Year
 *    column is always what's trusted for the year; Date of Burial,
 *    whether it arrives as a string ("12th June") or a real Date
 *    object, only ever contributes a day+month display string, never
 *    a year.
 *  - The "Extra" column is free text from whoever compiled/checked the
 *    register — burial type (e.g. "Casket of Ashes", "Scattered"),
 *    confidence ("check", "Queried", "No Register - Unchecked"), or a
 *    specific correction note ("check, down as Hutchinson"). Shown
 *    verbatim as a "Register note" on the record's page rather than
 *    trying to classify or reword it — asked for directly ("show the
 *    note on the page"), and it's too varied a vocabulary to safely
 *    summarise without risking putting words in the compiler's mouth.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "data", "burial-records.json");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-burial-records.js path/to/spreadsheet.xlsx");
  process.exit(1);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function cleanString(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

// Only ever pulls a day+month out of a real Date — see the file header
// comment above for why its year can't be trusted.
function dayMonthFromDate(d) {
  return d.getDate() + " " + MONTHS[d.getMonth()];
}

function burialDateDisplay(raw) {
  if (raw instanceof Date) return dayMonthFromDate(raw);
  const s = cleanString(raw);
  return s || null;
}

const wb = XLSX.readFile(inputPath, { cellDates: true });

const records = [];
let id = 0;

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  // First row is the header row on every sheet — skip it.
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const surname = cleanString(row[0]);
    const firstNames = cleanString(row[1]);
    if (!surname && !firstNames) continue; // blank spacer row

    const graveNo = cleanString(row[2]) || null;
    const burialDate = burialDateDisplay(row[3]);
    const yearRaw = row[4];
    const year = typeof yearRaw === "number" ? yearRaw : (cleanString(yearRaw) ? parseInt(cleanString(yearRaw), 10) : null);
    const ageRaw = row[5];
    const age = typeof ageRaw === "number" ? ageRaw : (cleanString(ageRaw) ? parseInt(cleanString(ageRaw), 10) : null);
    const note = cleanString(row[6]) || null;

    records.push({
      id: id++,
      name: cleanString([firstNames, surname].filter(Boolean).join(" ")),
      surname,
      firstNames,
      graveNo,
      burialDate,
      year: Number.isFinite(year) ? year : null,
      age: Number.isFinite(age) ? age : null,
      note
    });
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(records, null, 2) + "\n");
console.log("Wrote " + records.length + " burial records to " + path.relative(ROOT, OUTPUT));
