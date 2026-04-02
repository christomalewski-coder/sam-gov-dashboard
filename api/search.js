const tier1 = new Set(["CA","TX","NY","FL","IL","PA","OH","NC","GA","VA","MI","WA","CO","MA","NJ","AZ"]);
const tier2 = new Set(["IN","TN","MO","MN","WI","SC","AL","KY","OK","OR","MD","CT","IA","KS","NV","UT","NM"]);
const tier3 = new Set(["AR","MS","NE","ID","MT","WY","ND","SD","WV","ME","NH","VT","RI","DE"]);

const TARGET_AGENCIES = [
  "VETERANS", "ARMY", "AIR FORCE", "NAVY", "USACE", "GSA", "ENERGY", "DHS", "POSTAL"
];
const TARGET_NAICS = new Set(["238210", "238220", "335122", "335129", "423610", "541330", "561210"]);
const TARGET_PSC = new Set(["N046", "N059", "J065", "S112", "R425", "R499", "N063", "R408", "Z2JZ"]);
const KEYWORDS = ["LED", "LIGHT", "ESCO", "ENERGY", "CONTROL", "SPORT", "STREET", "MAINTENANCE", "RETROFIT"];

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

function scoreOpportunity(o) {
  const title = String(o.title || "").toUpperCase();
  const agency = String(o.fullParentPathName || "").toUpperCase();
  const setAside = String(o.typeOfSetAsideDescription || o.typeOfSetAside || "").toUpperCase();
  const naics = String(o.naicsCode || "");
  const psc = String(o.classificationCode || "");
  const awardCeiling = toNumber(o.awardCeiling);
  const state = String((o.placeOfPerformance && o.placeOfPerformance.state) || o.placeOfPerformanceState || "").toUpperCase();
  const dueDays = daysLeftFrom(o.responseDeadLine);
  const { tier, weight } = getStateTier(state);

  const keywordMatch = KEYWORDS.some(k => title.includes(k)) ? "Yes" : "No";
  const agencyTarget = TARGET_AGENCIES.some(k => agency.includes(k)) ? "Yes" : "No";
  const setAsideMatch = (setAside.includes("SDVOSB") || setAside.includes("VOSB")) ? "Yes"
    : ((setAside.includes("SMALL") || setAside.includes("8(A)") || setAside.includes("HUBZONE")) ? "Partial" : "No");
  const codeMatch = (TARGET_NAICS.has(naics) || TARGET_PSC.has(psc)) ? "Yes" : "No";

  let score = 0;
  if (keywordMatch === "Yes") score += 18;
  if (agencyTarget === "Yes") score += 12;
  if (setAsideMatch === "Yes") score += 20;
  else if (setAsideMatch === "Partial") score += 10;
  if (TARGET_NAICS.has(naics)) score += 10;
  if (TARGET_PSC.has(psc)) score += 10;
  if (dueDays !== "" && dueDays >= 0 && dueDays <= 14) score += 8;
  if (awardCeiling >= 100000) score += 10;
  score += weight * 2;

  let bucket = "Watch";
  if (dueDays !== "" && dueDays < 0) bucket = "Expired";
  else if (score >= 72) bucket = "Pursue";
  else if (score >= 50) bucket = "Review";

  const nextAction =
    bucket === "Pursue" ? "Call and qualify immediately" :
    bucket === "Review" ? "Assess teaming, pricing, and compliance" :
    bucket === "Watch" ? "Monitor and follow up" :
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
    "Fit": (keywordMatch === "Yes" || agencyTarget === "Yes" || codeMatch === "Yes") ? "High" : "Low",
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
    "City": (o.placeOfPerformance && o.placeOfPerformance.city) || o.placeOfPerformanceCity || "",
    "Notes": ""
  };
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.SAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing SAM_API_KEY environment variable." });
    }

    const postedFromDays = Number(req.query.postedFromDays || 14);
    const limit = Number(req.query.limit || 100);
    const q = req.query.q || '("LED" OR lighting OR "sports lighting" OR retrofit OR controls OR ESCO OR "energy savings")';
    const stateFilter = String(req.query.state || "").toUpperCase();
    const setAsideFilter = String(req.query.setAside || "").toUpperCase();
    const tierFilter = String(req.query.tier || "").toUpperCase();
    const ownerFilter = String(req.query.owner || "").toUpperCase();
function formatSamDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
   url.searchParams.set("postedFrom", formatSamDate(postedFrom));
url.searchParams.set("postedTo", formatSamDate(today));

    const url = new URL("https://api.sam.gov/prod/opportunities/v2/search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("postedFrom", postedFrom.toISOString().slice(0, 10));
    url.searchParams.set("postedTo", today.toISOString().slice(0, 10));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    url.searchParams.set("ptype", "o");
    url.searchParams.set("q", q);

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: "SAM.gov request failed", detail: text });
    }

    const data = await response.json();
    const raw = Array.isArray(data.opportunitiesData) ? data.opportunitiesData : [];
    let rows = raw.map(scoreOpportunity);

    if (stateFilter) rows = rows.filter(r => String(r["State"]).toUpperCase() === stateFilter);
    if (setAsideFilter) rows = rows.filter(r => String(r["Set-Aside"]).toUpperCase().includes(setAsideFilter));
    if (tierFilter) rows = rows.filter(r => String(r["State Tier"]).toUpperCase() === tierFilter);
    if (ownerFilter) rows = rows.filter(r => String(r["Owner"]).toUpperCase() === ownerFilter);

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
