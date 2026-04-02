const tier1 = new Set(["CA","TX","NY","FL","IL","PA","OH","NC","GA","VA","MI","WA","CO","MA","NJ","AZ"]);
const tier2 = new Set(["IN","TN","MO","MN","WI","SC","AL","KY","OK","OR","MD","CT","IA","KS","NV","UT","NM"]);
const tier3 = new Set(["AR","MS","NE","ID","MT","WY","ND","SD","WV","ME","NH","VT","RI","DE"]);

const TARGET_AGENCIES = [
  "VETERANS", "ARMY", "AIR FORCE", "NAVY", "USACE", "GSA", "ENERGY", "DHS", "POSTAL"
];

// Tightened for lighting-first targeting
const TARGET_NAICS = new Set([
  "238210", // Electrical Contractors
  "335122", // Commercial/Institutional Lighting Fixtures
  "335129"  // Other Lighting Equipment
]);

const TARGET_PSC = new Set([
  "N046", // Installation of lighting fixtures and lamps
  "N059"  // Installation of generators/other electrical? still useful when lighting packages appear
]);

// Strong positive phrases only
const STRONG_LIGHTING_PHRASES = [
  "LED LIGHTING",
  "LIGHTING RETROFIT",
  "LIGHTING UPGRADE",
  "LIGHTING REPLACEMENT",
  "FIXTURE REPLACEMENT",
  "RELIGHTING",
  "SPORTS LIGHTING",
  "FIELD LIGHTING",
  "STADIUM LIGHTING",
  "PARKING LOT LIGHTING",
  "SITE LIGHTING",
  "STREET LIGHTING",
  "ROADWAY LIGHTING",
  "EXTERIOR LIGHTING",
  "INTERIOR LIGHTING",
  "LIGHTING CONTROLS",
  "LED FIXTURE",
  "LIGHT POLE",
  "AREA LIGHTING"
];

// ESCO is only meaningful if lighting is also present
const ESCO_PHRASES = [
  "ESCO",
  "ENERGY SAVINGS PERFORMANCE CONTRACT",
  "PERFORMANCE CONTRACT"
];

// Hard exclusions for junk / unrelated scopes
const EXCLUDE_KEYWORDS = [
  "HVAC",
  "AIR HANDLER",
  "CHILLER",
  "BOILER",
  "GENERATOR",
  "UPS",
  "BATTERY SYSTEM",
  "INTRUSION",
  "ACCESS CONTROL",
  "SECURITY CAMERA",
  "VIDEO SURVEILLANCE",
  "STERILIZER",
  "STERILIZATION",
  "TELERADIOLOGY",
  "RADIOLOGY",
  "MEDICAL GAS",
  "LAUNDRY",
  "GROUNDS MAINTENANCE",
  "LANDSCAPING",
  "TREE TRIMMING",
  "JANITORIAL",
  "CUSTODIAL",
  "ROOFING",
  "PLUMBING",
  "DOOR HARDWARE",
  "FIRE ALARM",
  "SPRINKLER",
  "ELEVATOR",
  "PAVING",
  "CONCRETE",
  "PAINTING SERVICES",
  "INSTRUCTIONAL DESIGN",
  "TRAINING SUPPORT",
  "STAFFING",
  "TELCOM",
  "TELECOMMUNICATIONS",
  "NETWORKING",
  "SERVER ROOM"
];

function getStateTier(state) {
  if (tier1.has(state)) return { tier: "Tier 1", weight: 5 };
  if (tier2.has(state)) return { tier: "Tier 2", weight: 3 };
  if (tier3.has(state)) return { tier: "Tier 3", weight: 1 };
  return { tier: "", weight: 0 };
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function daysLeftFrom(dueDate) {
  if (!dueDate) return "";
  const now = new Date();
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return "";
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function formatSamDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function includesAny(text, phrases) {
  return phrases.some(p => text.includes(p));
}

function hasStrongLightingSignal(title, description = "") {
  const text = `${title} ${description}`.toUpperCase();
  return includesAny(text, STRONG_LIGHTING_PHRASES);
}

function hasEscoLightingSignal(title, description = "") {
  const text = `${title} ${description}`.toUpperCase();
  return includesAny(text, ESCO_PHRASES) && includesAny(text, ["LIGHT", "LIGHTING", "LED", "FIXTURE"]);
}

function hasExclusion(title, description = "") {
  const text = `${title} ${description}`.toUpperCase();
  return includesAny(text, EXCLUDE_KEYWORDS);
}

function isLightingFit(o) {
  const title = String(o.title || "");
  const description = String(o.description || o.additionalInfoLinkDescription || "");
  const naics = String(o.naicsCode || "");
  const psc = String(o.classificationCode || "");

  const strongLighting = hasStrongLightingSignal(title, description);
  const escoLighting = hasEscoLightingSignal(title, description);
  const codeLighting = TARGET_NAICS.has(naics) || TARGET_PSC.has(psc);

  // If it's excluded and doesn't have a very strong lighting phrase, reject it
  if (hasExclusion(title, description) && !strongLighting) {
    return false;
  }

  // Must have one strong reason to be in the pipeline
  return strongLighting || escoLighting || codeLighting;
}

function scoreOpportunity(o) {
  const title = String(o.title || "").toUpperCase();
  const description = String(o.description || o.additionalInfoLinkDescription || "").toUpperCase();
  const combinedText = `${title} ${description}`;

  const agency = String(o.fullParentPathName || "").toUpperCase();
  const setAside = String(o.typeOfSetAsideDescription || o.typeOfSetAside || "").toUpperCase();
  const naics = String(o.naicsCode || "");
  const psc = String(o.classificationCode || "");
  const awardCeiling = toNumber(o.awardCeiling);

  const place = o.placeOfPerformance || {};
  const state = String(place.state || o.placeOfPerformanceState || "").toUpperCase();
  const city = String(place.city || o.placeOfPerformanceCity || "");

  const dueDays = daysLeftFrom(o.responseDeadLine);
  const { tier, weight } = getStateTier(state);

  const strongLighting = hasStrongLightingSignal(title, description);
  const escoLighting = hasEscoLightingSignal(title, description);

  const keywordMatch = strongLighting || escoLighting ? "Yes" : "No";
  const agencyTarget = TARGET_AGENCIES.some(k => agency.includes(k)) ? "Yes" : "No";
  const setAsideMatch =
    (setAside.includes("SDVOSB") || setAside.includes("VOSB")) ? "Yes" :
    ((setAside.includes("SMALL") || setAside.includes("8(A)") || setAside.includes("HUBZONE")) ? "Partial" : "No");
  const codeMatch = (TARGET_NAICS.has(naics) || TARGET_PSC.has(psc)) ? "Yes" : "No";

  let score = 0;

  // Heavy weight on real lighting scope
  if (strongLighting) score += 35;
  if (escoLighting) score += 12;

  if (agencyTarget === "Yes") score += 10;
  if (setAsideMatch === "Yes") score += 18;
  else if (setAsideMatch === "Partial") score += 8;

  if (TARGET_NAICS.has(naics)) score += 12;
  if (TARGET_PSC.has(psc)) score += 12;

  if (dueDays !== "" && dueDays >= 0 && dueDays <= 14) score += 8;
  if (awardCeiling >= 100000) score += 10;
  if (awardCeiling >= 500000) score += 5;

  score += weight * 2;

  // Penalty for non-lighting signals sneaking through via code match
  if (!strongLighting && !escoLighting) score -= 20;

  let bucket = "Watch";
  if (dueDays !== "" && dueDays < 0) bucket = "Expired";
  else if (score >= 72 && (strongLighting || escoLighting || TARGET_PSC.has(psc))) bucket = "Pursue";
  else if (score >= 50 && (strongLighting || escoLighting || TARGET_NAICS.has(naics) || TARGET_PSC.has(psc))) bucket = "Review";

  const nextAction =
    bucket === "Pursue" ? "Call and qualify immediately" :
    bucket === "Review" ? "Assess scope, pricing, and teaming fit" :
    bucket === "Watch" ? "Monitor only if lighting scope becomes clearer" :
    "Archive or close";

  return {
    "Notice ID": o.noticeId || "",
    "Title": o.title || "",
    "Agency": o.fullParentPathName || "",
    "Office": o.office || "",
    "Posted Date": o.postedDate || "",
    "Due Date": o.responseDeadLine || "",
    "Days Left": dueDays,
    "Set-Aside": o.typeOfSetAsideDescription || o.typeOfSetAside || "",
    "NAICS": naics,
    "PSC": psc,
    "Estimated Value ($)": awardCeiling,
    "Status": "New",
    "Fit": strongLighting || escoLighting ? "High" : (codeMatch === "Yes" ? "Medium" : "Low"),
    "Capture Stage": "Identify",
    "Keyword Match?": keywordMatch,
    "Agency Target?": agencyTarget,
    "Set-Aside Match?": setAsideMatch,
    "Code Match?": codeMatch,
    "State": state,
    "State Tier": tier,
    "State Weight": weight,
    "Priority Score": score,
    "Priority Bucket": bucket,
    "Next Action": nextAction,
    "Owner": "Chris",
    "Source URL": o.uiLink || "",
    "City": city,
    "Notes": ""
  };
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.SAM_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing SAM_API_KEY environment variable."
      });
    }

    const postedFromDays = Number(req.query.postedFromDays || 14);
    const limit = Number(req.query.limit || 100);

    // Tightened default query
    const q = req.query.q || '(("LED lighting" OR "lighting retrofit" OR relighting OR "sports lighting" OR "street lighting" OR "parking lot lighting" OR "lighting controls" OR "interior lighting" OR "exterior lighting" OR "fixture replacement") OR ("energy savings performance contract" AND lighting) OR (ESCO AND lighting))';

    const stateFilter = String(req.query.state || "").toUpperCase();
    const setAsideFilter = String(req.query.setAside || "").toUpperCase();
    const tierFilter = String(req.query.tier || "").toUpperCase();
    const ownerFilter = String(req.query.owner || "").toUpperCase();

    const today = new Date();
    const postedFrom = new Date(today.getTime() - postedFromDays * 24 * 60 * 60 * 1000);

    const url = new URL("https://api.sam.gov/prod/opportunities/v2/search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("postedFrom", formatSamDate(postedFrom));
    url.searchParams.set("postedTo", formatSamDate(today));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    url.searchParams.set("ptype", "o");
    url.searchParams.set("q", q);

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "SAM.gov request failed",
        detail: text
      });
    }

    const data = await response.json();
    const raw = Array.isArray(data.opportunitiesData) ? data.opportunitiesData : [];

    // Hard filter before scoring
    let rows = raw
      .filter(isLightingFit)
      .map(scoreOpportunity)
      .filter(r => r["Priority Bucket"] !== "Expired" || r["Days Left"] === "");

    if (stateFilter) {
      rows = rows.filter(r => String(r["State"]).toUpperCase() === stateFilter);
    }

    if (setAsideFilter) {
      rows = rows.filter(r => String(r["Set-Aside"]).toUpperCase().includes(setAsideFilter));
    }

    if (tierFilter) {
      rows = rows.filter(r => String(r["State Tier"]).toUpperCase() === tierFilter);
    }

    if (ownerFilter) {
      rows = rows.filter(r => String(r["Owner"]).toUpperCase() === ownerFilter);
    }

    rows.sort((a, b) => Number(b["Priority Score"] || 0) - Number(a["Priority Score"] || 0));

    return res.status(200).json({
      count: rows.length,
      rows
    });
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error.",
      detail: err && err.message ? err.message : String(err)
    });
  }
};
