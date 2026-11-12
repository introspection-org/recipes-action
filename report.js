#!/usr/bin/env node
"use strict";

// Print a readable listing of an `introspection check` JSON report and exit
// non-zero when the recipe is invalid, so the job fails.

const fs = require("fs");

const reportPath = process.argv[2];
const recipeDirRaw = process.env.RECIPE_DIR || ".";
const recipeDir =
  recipeDirRaw && recipeDirRaw !== "." ? recipeDirRaw.replace(/\/+$/, "") : "";

const oneLine = (value) =>
  String(value == null ? "" : value)
    .replace(/\r?\n/g, " ")
    .trim();

function annotate(command, message) {
  console.log(`::${command}::${message}`);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (err) {
  annotate(
    "error",
    `recipes-action: could not read the recipe-check report (${oneLine(
      err.message
    )}). The checker may have crashed before producing output.`
  );
  process.exit(1);
}

const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
const manifests = Array.isArray(report.manifests) ? report.manifests : [];
const errors = diagnostics.filter((d) => d.severity === "error");
const warnings = diagnostics.filter((d) => d.severity === "warning");
const valid = errors.length === 0;
const recipes = manifests.length
  ? manifests.map((m) => m.name).join(", ")
  : "<no recipes found>";
const fileOf = (d) =>
  d.path ? (recipeDir ? `${recipeDir}/${d.path}` : d.path) : "";
const locOf = (d) => {
  const file = fileOf(d);
  if (!file) return "";
  return d.span && d.span.line ? `${file}:${d.span.line}` : file;
};

// Annotations and the job summary come from the CLI itself.
console.log(`\nRecipe check — ${recipes}`);
for (const d of diagnostics) {
  const where = locOf(d);
  console.log(
    `  ${d.severity}: ${d.check_id}: ${oneLine(d.message)}${
      where ? ` (${where})` : ""
    }`
  );
  if (d.help) console.log(`    help: ${oneLine(d.help)}`);
}
console.log(
  `\n${valid ? "PASS" : "FAIL"}: ${errors.length} error(s), ${
    warnings.length
  } warning(s)`
);

process.exit(valid ? 0 : 1);
