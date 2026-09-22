const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER"
];

// Dates are stored as plain ISO days. new Date("2026-07-06") parses as UTC midnight and
// then renders in local time, which moves the printed day backwards west of Greenwich.
// Splitting the string keeps the filed date the date that was filed.
export function formatFiled(isoDay) {
  const [year, month, day] = isoDay.split("-").map(Number);
  const name = MONTHS[month - 1];
  return name ? `${day} ${name} ${year}` : isoDay;
}

export function renderIndex(list, entries) {
  list.replaceChildren();

  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "dispatch-entry";

    const link = document.createElement("a");
    link.href = `./${entry.slug}`;

    const issue = document.createElement("span");
    issue.className = "dispatch-entry-issue mono";
    issue.textContent = `ISSUE ${String(entry.issue).padStart(2, "0")}`;

    const title = document.createElement("span");
    title.className = "dispatch-entry-title";
    title.textContent = entry.title;

    const dek = document.createElement("span");
    dek.className = "dispatch-entry-dek";
    dek.textContent = entry.dek;

    const filed = document.createElement("span");
    filed.className = "dispatch-entry-filed mono";
    filed.textContent = formatFiled(entry.date);

    link.append(issue, title, dek, filed);
    item.append(link);
    list.append(item);
  }
}

async function bootstrapIndex() {
  const list = document.getElementById("dispatch-index");
  const empty = document.getElementById("dispatch-empty");
  if (!list || !empty) {
    return;
  }

  try {
    const response = await fetch("./index.json");
    if (!response.ok) {
      throw new Error(`index.json responded ${response.status}`);
    }
    const { dispatches } = await response.json();
    if (!Array.isArray(dispatches) || dispatches.length === 0) {
      throw new Error("index.json listed no dispatches");
    }
    renderIndex(list, dispatches);
  } catch {
    // The archive is a list of links to pages that exist on their own. A failed index
    // should say so plainly rather than leaving an empty page that looks intentional.
    empty.hidden = false;
  }
}

bootstrapIndex();
