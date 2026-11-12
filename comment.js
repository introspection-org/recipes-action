#!/usr/bin/env node
"use strict";

// Post an `introspection check` report to the pull request as one comment,
// updated in place on every run. A run that can't write to the pull request
// (a fork, or a workflow without `pull-requests: write`) skips with a notice.

const fs = require("fs");

const reportPath = process.argv[2];
const recipeDir = (process.env.RECIPE_DIR || ".").replace(/\/+$/, "") || ".";
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const api = process.env.GITHUB_API_URL || "https://api.github.com";
const runUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const marker = `<!-- recipes-action:recipe-check:${recipeDir} -->`;

function notice(message) {
  console.log(`::notice title=recipes-action::${message}`);
}

function pullNumber() {
  try {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    return event.pull_request && event.pull_request.number;
  } catch {
    return undefined;
  }
}

const cell = (value) =>
  String(value == null ? "" : value)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");

function body(report) {
  const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;
  const where = recipeDir === "." ? "" : ` in \`${cell(recipeDir)}\``;
  const lines = [marker];
  lines.push(
    errors
      ? `### ❌ Recipe check failed${where}: ${errors} error(s), ${warnings} warning(s)`
      : `### ✅ Recipe check passed${where}${warnings ? `: ${warnings} warning(s)` : ""}`
  );
  if (diagnostics.length) {
    lines.push("", "| | Check | Where | Problem | Fix |", "| --- | --- | --- | --- | --- |");
    for (const d of diagnostics) {
      const file = d.path ? (recipeDir === "." ? d.path : `${recipeDir}/${d.path}`) : "";
      const at = file && d.span && d.span.line ? `${file}:${d.span.line}` : file;
      lines.push(
        `| ${d.severity === "error" ? "🔴" : "🟡"} | \`${cell(d.check_id)}\` | ${
          at ? `\`${cell(at)}\`` : ""
        } | ${cell(d.message)} | ${cell(d.help)} |`
      );
    }
  }
  lines.push("", `<sub>[Run](${runUrl})</sub>`);
  return lines.join("\n");
}

async function github(method, path, payload) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    const error = new Error(`${method} ${path}: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function existingComment(number) {
  for (let page = 1; ; page++) {
    const comments = await github(
      "GET",
      `/repos/${repository}/issues/${number}/comments?per_page=100&page=${page}`
    );
    const found = comments.find((c) => c.body && c.body.startsWith(marker));
    if (found || comments.length < 100) return found;
  }
}

async function main() {
  const number = pullNumber();
  if (!number) return;
  if (!token) {
    notice("no token, so the result isn't posted to the pull request");
    return;
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return; // report.js already failed the job on an unreadable report.
  }
  const text = body(report);
  const failed = (report.diagnostics || []).some((d) => d.severity === "error");
  try {
    const comment = await existingComment(number);
    if (comment) {
      await github("PATCH", `/repos/${repository}/issues/comments/${comment.id}`, { body: text });
    } else if (failed || (report.diagnostics || []).length) {
      await github("POST", `/repos/${repository}/issues/${number}/comments`, { body: text });
    }
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      notice(
        "can't comment on this pull request; give the workflow `pull-requests: write` to see results there"
      );
      return;
    }
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.log(`::warning title=recipes-action::could not post the pull request comment (${error.message})`);
  });
}

module.exports = { body, marker };
